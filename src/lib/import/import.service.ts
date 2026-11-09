import { eq, and, sql } from 'drizzle-orm';
import { importBatches, importRows, auditLogs } from '@/db/schema/system';
import { guests, guestGroups } from '@/db/schema/guests';
import { sanitizeFromSpreadsheet } from '@/lib/export/formula-sanitizer';
import { createGuestSchema } from '@/schemas/guests';
import { TxOrDb } from '@/lib/finance/costs.repository';

export class ImportBatchNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy lô nhập dữ liệu') {
    super(message);
    this.name = 'ImportBatchNotFoundError';
  }
}

export class ImportBatchHasErrorsError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Lô nhập dữ liệu chứa dòng lỗi, không thể commit toàn bộ (AT27)') {
    super(message);
    this.name = 'ImportBatchHasErrorsError';
  }
}

export interface RawGuestRowInput {
  display_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  side?: string;
  age_tier?: string;
  group_name?: string;
  notes?: string;
}

/**
 * Stages an atomic batch import of guests.
 *
 * Invariants:
 * - AT27: If a batch of 50 rows has 1 error row, it is isolated in import_rows with error messages.
 *   The batch remains 'staged' and zero partial writes occur in the main guests table.
 * - AT29: Sanitizes spreadsheet formulas on import.
 */
export async function stageGuestImport(
  txDb: TxOrDb,
  fileName: string,
  rawRows: RawGuestRowInput[],
  userId: string
) {
  let validRowsCount = 0;
  let errorRowsCount = 0;

  const processedRows: Array<{
    rowIndex: number;
    rawData: Record<string, unknown>;
    isValid: boolean;
    errorMessages: string[];
    parsedData?: any;
  }> = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];

    // Sanitize formulas (AT29)
    const sanitizedName = sanitizeFromSpreadsheet(raw.display_name);
    const sanitizedPhone = sanitizeFromSpreadsheet(raw.phone) || null;
    const sanitizedEmail = sanitizeFromSpreadsheet(raw.email) || null;
    const sanitizedAddress = sanitizeFromSpreadsheet(raw.address) || null;
    const sanitizedNotes = sanitizeFromSpreadsheet(raw.notes) || null;

    const rowPayload = {
      display_name: sanitizedName,
      phone: sanitizedPhone,
      email: sanitizedEmail,
      address: sanitizedAddress,
      side: raw.side || 'mutual',
      age_tier: raw.age_tier || 'adult',
      private_notes: sanitizedNotes,
      sub_tags: raw.group_name ? [raw.group_name.trim()] : [],
    };

    const parsed = createGuestSchema.safeParse(rowPayload);

    if (parsed.success) {
      validRowsCount++;
      processedRows.push({
        rowIndex: i + 1,
        rawData: raw as Record<string, unknown>,
        isValid: true,
        errorMessages: [],
        parsedData: parsed.data,
      });
    } else {
      errorRowsCount++;
      const errorMessages = parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      processedRows.push({
        rowIndex: i + 1,
        rawData: raw as Record<string, unknown>,
        isValid: false,
        errorMessages,
      });
    }
  }

  // Insert batch header
  const [batch] = await txDb
    .insert(importBatches)
    .values({
      userId,
      importType: 'guests',
      fileName,
      totalRows: rawRows.length,
      validRows: validRowsCount,
      errorRows: errorRowsCount,
      skippedRows: 0,
      status: 'staged',
    })
    .returning();

  // Insert rows
  if (processedRows.length > 0) {
    await txDb.insert(importRows).values(
      processedRows.map((r) => ({
        batchId: batch.id,
        rowIndex: r.rowIndex,
        rawData: r.rawData,
        errorMessages: r.errorMessages,
        isValid: r.isValid,
        isSkipped: false,
      }))
    );
  }

  return {
    batchId: batch.id,
    fileName,
    totalRows: rawRows.length,
    validRows: validRowsCount,
    errorRows: errorRowsCount,
    status: batch.status,
    rows: processedRows,
  };
}

/**
 * Commits a staged batch atomically in a single database transaction.
 *
 * Invariant (AT27):
 * Rejects commit if errorRows > 0.
 * If any DB error occurs, the entire transaction rolls back cleanly with 0 partial writes.
 */
export async function commitGuestImport(
  txDb: TxOrDb,
  batchId: string,
  userId: string
) {
  // 1. Fetch batch
  const [batch] = await txDb
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new ImportBatchNotFoundError();
  }

  if (batch.status === 'committed') {
    return { success: true, message: 'Lô đã được commit trước đó', committedCount: batch.validRows };
  }

  if (batch.errorRows > 0) {
    throw new ImportBatchHasErrorsError();
  }

  // 2. Fetch all valid rows
  const rows = await txDb
    .select()
    .from(importRows)
    .where(and(eq(importRows.batchId, batchId), eq(importRows.isValid, true)));

  // 3. Atomically insert all guests into main table
  let committedCount = 0;
  for (const row of rows) {
    const raw = row.rawData as any;
    const [insertedGuest] = await txDb
      .insert(guests)
      .values({
        displayName: raw.display_name,
        phone: raw.phone || null,
        email: raw.email || null,
        address: raw.address || null,
        side: raw.side || 'mutual',
        ageTier: raw.age_tier || 'adult',
        privateNotes: raw.notes || null,
        isArchived: false,
        version: 1,
      })
      .returning({ id: guests.id });

    // Link targetEntityId in row
    await txDb
      .update(importRows)
      .set({ targetEntityId: insertedGuest.id })
      .where(eq(importRows.id, row.id));

    committedCount++;
  }

  // 4. Update batch status to committed
  const [updatedBatch] = await txDb
    .update(importBatches)
    .set({
      status: 'committed',
      committedAt: new Date(),
    })
    .where(eq(importBatches.id, batchId))
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'COMMIT_IMPORT_BATCH',
    entityType: 'import_batches',
    entityId: batchId,
    beforeState: batch,
    afterState: updatedBatch,
  });

  return {
    success: true,
    batchId,
    committedCount,
  };
}

/**
 * Rolls back an import batch.
 */
export async function rollbackGuestImport(
  txDb: TxOrDb,
  batchId: string,
  userId: string
) {
  const [batch] = await txDb
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new ImportBatchNotFoundError();
  }

  // If already committed, delete the inserted guests
  if (batch.status === 'committed') {
    const rows = await txDb
      .select({ targetEntityId: importRows.targetEntityId })
      .from(importRows)
      .where(and(eq(importRows.batchId, batchId), sql`${importRows.targetEntityId} IS NOT NULL`));

    const guestIds = rows.map((r: any) => r.targetEntityId).filter(Boolean);
    if (guestIds.length > 0) {
      await txDb.delete(guests).where(sql`${guests.id} IN ${guestIds}`);
    }
  }

  const [rolledBack] = await txDb
    .update(importBatches)
    .set({
      status: 'rolled_back',
      rolledBackAt: new Date(),
    })
    .where(eq(importBatches.id, batchId))
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'ROLLBACK_IMPORT_BATCH',
    entityType: 'import_batches',
    entityId: batchId,
    beforeState: batch,
    afterState: rolledBack,
  });

  return { success: true, batchId, status: 'rolled_back' };
}
