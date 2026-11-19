import { and, eq, sql } from 'drizzle-orm';
import { withTransactionScopedContext } from '@/db/client';
import { weddingSettings, events } from '@/db/schema/events';
import { budgetCategories } from '@/db/schema/finance';
import type { UserSession } from '@/lib/auth/session';
import type { SetupInput } from '@/schemas/settings';

export async function getWeddingSettings(session: UserSession) {
  return withTransactionScopedContext(session.user.id, session.role, async (_client, db) => {
    // Deliberately select only public fields; family users cannot read budget targets.
    const [settings] = await db.select({
      id: weddingSettings.id,
      groomName: weddingSettings.groomName,
      brideName: weddingSettings.brideName,
      shortTitle: weddingSettings.shortTitle,
      tentativeDateNote: weddingSettings.tentativeDateNote,
      isDateConfirmed: weddingSettings.isDateConfirmed,
      representativeEventId: weddingSettings.representativeEventId,
      version: weddingSettings.version,
    }).from(weddingSettings).limit(1);
    return settings ?? null;
  });
}

export async function initializeWedding(session: UserSession, input: SetupInput) {
  return withTransactionScopedContext(session.user.id, session.role, async (client, db) => {
    // Two owners or duplicate clicks must never create two weddings/events.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('wedding-settings'))");
    const [existing] = await db.select({ id: weddingSettings.id }).from(weddingSettings).limit(1);
    if (existing) return { id: existing.id, created: false };
    const [event] = await db.insert(events).values({
      title: `Đám cưới ${input.groomName} & ${input.brideName}`,
      eventType: 'wedding_party',
      status: input.isUnconfirmedDate ? 'tentative' : 'confirmed',
      startTime: input.isUnconfirmedDate ? null : new Date(`${input.weddingDate}T00:00:00+07:00`),
    }).returning({ id: events.id });
    const [settings] = await db.insert(weddingSettings).values({
      groomName: input.groomName,
      brideName: input.brideName,
      shortTitle: `${input.groomName} & ${input.brideName}`,
      tentativeDateNote: input.isUnconfirmedDate ? input.estimatedDateNote : '',
      isDateConfirmed: !input.isUnconfirmedDate,
      representativeEventId: event.id,
    }).returning({ id: weddingSettings.id });
    if (input.categories.length) {
      await db.insert(budgetCategories).values(input.categories.map((category, index) => ({
        name: category.name, defaultOrder: index,
      }))).onConflictDoNothing({ target: budgetCategories.name });
    }
    return { id: settings.id, created: true };
  });
}

export async function updateWeddingTitle(session: UserSession, shortTitle: string, version: number) {
  return withTransactionScopedContext(session.user.id, session.role, async (_client, db) => {
    const [settings] = await db.select({ id: weddingSettings.id }).from(weddingSettings).limit(1);
    if (!settings) return null;
    const [updated] = await db.update(weddingSettings).set({
      shortTitle, version: sql`${weddingSettings.version} + 1`, updatedAt: new Date(),
    }).where(and(eq(weddingSettings.id, settings.id), eq(weddingSettings.version, version)))
      .returning({ id: weddingSettings.id, shortTitle: weddingSettings.shortTitle, version: weddingSettings.version });
    return updated ?? null;
  });
}
