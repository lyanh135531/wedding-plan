import { eq, and, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import {
  menus,
  menuItems,
  guestMealSelections,
  cateringSnapshots,
  attendance,
  guests,
} from '@/db/schema';
import {
  MealTier,
  GuestMealSelectionDto,
  MealSummaryDto,
  CateringSnapshotDto,
  guestMealSelectionDtoSchema,
  mealSummaryDtoSchema,
  cateringSnapshotDtoSchema,
} from '@/schemas/catering';
import { CateringSnapshotLockedError, MenuNotFoundError } from './errors';

import { TxDb } from './types';

export function mapToGuestMealSelectionDto(
  row: typeof guestMealSelections.$inferSelect
): GuestMealSelectionDto {
  return guestMealSelectionDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    guestId: row.guestId,
    mealTier: row.mealTier,
    dietaryNotes: row.dietaryNotes ?? null,
    allergyNotes: row.allergyNotes ?? null,
    version: row.version,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  });
}

export function mapToCateringSnapshotDto(
  row: typeof cateringSnapshots.$inferSelect
): CateringSnapshotDto {
  return cateringSnapshotDtoSchema.parse({
    id: row.id,
    eventId: row.eventId,
    menuId: row.menuId ?? null,
    snapshotVersion: row.snapshotVersion,
    adultMeals: row.adultMeals,
    childMeals: row.childMeals,
    vegetarianMeals: row.vegetarianMeals,
    specialMeals: row.specialMeals,
    bufferMeals: row.bufferMeals,
    totalMeals: row.totalMeals,
    notes: row.notes ?? null,
    isLocked: row.isLocked,
    lockedAt: row.lockedAt ? (row.lockedAt instanceof Date ? row.lockedAt.toISOString() : String(row.lockedAt)) : null,
    lockedBy: row.lockedBy ? String(row.lockedBy) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  });
}

/**
 * Sets or updates a guest's meal tier selection and allergies.
 */
export async function setGuestMealSelection(
  txDb: TxDb,
  eventId: string,
  guestId: string,
  mealTier: MealTier,
  dietaryNotes?: string | null,
  allergyNotes?: string | null
): Promise<GuestMealSelectionDto> {
  const [existing] = await txDb
    .select()
    .from(guestMealSelections)
    .where(
      and(
        eq(guestMealSelections.eventId, eventId),
        eq(guestMealSelections.guestId, guestId)
      )
    )
    .for('update');

  if (existing) {
    const [updated] = await txDb
      .update(guestMealSelections)
      .set({
        mealTier,
        dietaryNotes: dietaryNotes ?? null,
        allergyNotes: allergyNotes ?? null,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(guestMealSelections.id, existing.id))
      .returning();

    return mapToGuestMealSelectionDto(updated);
  }

  const [created] = await txDb
    .insert(guestMealSelections)
    .values({
      eventId,
      guestId,
      mealTier,
      dietaryNotes: dietaryNotes ?? null,
      allergyNotes: allergyNotes ?? null,
      version: 1,
    })
    .returning();

  return mapToGuestMealSelectionDto(created);
}

/**
 * Calculates meal summary:
 * Aggregates counts of adult, child, vegetarian, and special meals
 * against confirmed RSVP attendance records (rsvp_status = 'accepted' and needs_meal = true).
 * Strictly guarantees exact integer arithmetic (0 floating point errors).
 */
export async function calculateMealSummary(
  txDb: TxDb,
  eventId: string,
  bufferPercentage = 0
): Promise<MealSummaryDto> {
  // Query all accepted attendances with needs_meal = true
  const acceptedAttendances = await txDb
    .select({
      guestId: attendance.guestId,
      mealDietaryTier: attendance.mealDietaryTier,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.eventId, eventId),
        eq(attendance.rsvpStatus, 'accepted'),
        eq(attendance.needsMeal, true)
      )
    );

  const confirmedGuestIds = acceptedAttendances.map((a) => a.guestId);

  let adultMeals = 0;
  let childMeals = 0;
  let vegetarianMeals = 0;
  let specialMeals = 0;
  let missingMealSelectionCount = 0;

  if (confirmedGuestIds.length > 0) {
    // Query explicit guest meal selections
    const selections = await txDb
      .select({
        guestId: guestMealSelections.guestId,
        mealTier: guestMealSelections.mealTier,
      })
      .from(guestMealSelections)
      .where(
        and(
          eq(guestMealSelections.eventId, eventId),
          inArray(guestMealSelections.guestId, confirmedGuestIds)
        )
      );

    const selectionMap = new Map(selections.map((s) => [s.guestId, s.mealTier]));

    // Query guests for ageTier fallback
    const guestProfiles = await txDb
      .select({
        id: guests.id,
        ageTier: guests.ageTier,
      })
      .from(guests)
      .where(inArray(guests.id, confirmedGuestIds));

    const guestProfileMap = new Map(guestProfiles.map((g) => [g.id, g.ageTier]));
    const attendanceMap = new Map(acceptedAttendances.map((a) => [a.guestId, a.mealDietaryTier]));

    for (const gid of confirmedGuestIds) {
      const explicitTier = selectionMap.get(gid);
      if (explicitTier) {
        switch (explicitTier) {
          case 'standard':
            adultMeals++;
            break;
          case 'vegetarian':
            vegetarianMeals++;
            break;
          case 'child':
            childMeals++;
            break;
          case 'special':
            specialMeals++;
            break;
        }
      } else {
        missingMealSelectionCount++;
        // Fallback to guest ageTier or attendance mealDietaryTier
        const ageTier = guestProfileMap.get(gid);
        const dietaryTier = attendanceMap.get(gid);

        if (ageTier === 'child' || dietaryTier === 'child_portion') {
          childMeals++;
        } else if (dietaryTier === 'vegetarian') {
          vegetarianMeals++;
        } else if (dietaryTier === 'special') {
          specialMeals++;
        } else {
          adultMeals++;
        }
      }
    }
  }

  const confirmedMeals = adultMeals + childMeals + vegetarianMeals + specialMeals;

  // Exact integer math for buffer meals
  let bufferMeals = 0;
  if (bufferPercentage > 0 && confirmedMeals > 0) {
    bufferMeals = Math.ceil((confirmedMeals * bufferPercentage) / 100);
  }

  const totalMeals = confirmedMeals + bufferMeals;

  return mealSummaryDtoSchema.parse({
    eventId,
    adultMeals,
    childMeals,
    vegetarianMeals,
    specialMeals,
    confirmedMeals,
    bufferMeals,
    totalMeals,
    confirmedGuestsCount: confirmedGuestIds.length,
    missingMealSelectionCount,
  });
}

/**
 * Creates and locks a frozen catering snapshot with the restaurant.
 */
export async function createAndLockCateringSnapshot(
  txDb: TxDb,
  eventId: string,
  menuId: string | null,
  userId: string,
  bufferPercentage = 0,
  notes?: string
): Promise<CateringSnapshotDto> {
  if (menuId) {
    const [menu] = await txDb
      .select()
      .from(menus)
      .where(eq(menus.id, menuId));
    if (!menu) {
      throw new MenuNotFoundError();
    }
  }

  // Get next snapshot version
  const [latestSnapshot] = await txDb
    .select({ snapshotVersion: cateringSnapshots.snapshotVersion })
    .from(cateringSnapshots)
    .where(eq(cateringSnapshots.eventId, eventId))
    .orderBy(sql`${cateringSnapshots.snapshotVersion} DESC`)
    .limit(1);

  const nextVersion = latestSnapshot ? latestSnapshot.snapshotVersion + 1 : 1;

  // Compute meal summary
  const summary = await calculateMealSummary(txDb, eventId, bufferPercentage);

  const [snapshot] = await txDb
    .insert(cateringSnapshots)
    .values({
      eventId,
      menuId: menuId ?? null,
      snapshotVersion: nextVersion,
      adultMeals: summary.adultMeals,
      childMeals: summary.childMeals,
      vegetarianMeals: summary.vegetarianMeals,
      specialMeals: summary.specialMeals,
      bufferMeals: summary.bufferMeals,
      totalMeals: summary.totalMeals,
      notes: notes ?? null,
      isLocked: true,
      lockedAt: new Date(),
      lockedBy: userId,
    })
    .returning();

  return mapToCateringSnapshotDto(snapshot);
}
