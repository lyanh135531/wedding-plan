import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  timelineItems,
  timelineStatusEnum,
  gifts,
  giftContributors,
  giftReturns,
  giftTypeEnum,
  reconciliationStatusEnum,
  handoverPackets,
  postWeddingTasks,
  handoverStatusEnum,
  attendance,
  events,
  weddingSettings,
} from '@/db/schema';

describe('Gate G10 Database Schema & Migration Verifications', () => {
  it('defines timeline_items table with all required columns and constraints', () => {
    const config = getTableConfig(timelineItems);
    expect(config.name).toBe('timeline_items');

    const columnNames = config.columns.map((c) => c.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('event_id');
    expect(columnNames).toContain('title');
    expect(columnNames).toContain('category');
    expect(columnNames).toContain('scheduled_start_time');
    expect(columnNames).toContain('scheduled_end_time');
    expect(columnNames).toContain('actual_start_time');
    expect(columnNames).toContain('actual_end_time');
    expect(columnNames).toContain('location_name');
    expect(columnNames).toContain('person_in_charge');
    expect(columnNames).toContain('in_charge_phone');
    expect(columnNames).toContain('backup_person');
    expect(columnNames).toContain('backup_phone');
    expect(columnNames).toContain('support_assignment_id');
    expect(columnNames).toContain('assigned_item_ids');
    expect(columnNames).toContain('assigned_task_ids');
    expect(columnNames).toContain('operational_notes');
    expect(columnNames).toContain('is_shared');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('sort_order');
    expect(columnNames).toContain('version');

    expect(timelineStatusEnum.enumValues).toEqual([
      'not_started',
      'in_progress',
      'completed',
      'skipped',
    ]);
  });

  it('defines gifts, gift_contributors, and gift_returns tables with proper columns', () => {
    const giftsConfig = getTableConfig(gifts);
    expect(giftsConfig.name).toBe('gifts');
    const giftsCols = giftsConfig.columns.map((c) => c.name);
    expect(giftsCols).toContain('id');
    expect(giftsCols).toContain('event_id');
    expect(giftsCols).toContain('gift_type');
    expect(giftsCols).toContain('amount');
    expect(giftsCols).toContain('description');
    expect(giftsCols).toContain('received_by_user_id');
    expect(giftsCols).toContain('envelope_code');
    expect(giftsCols).toContain('is_sender_identified');
    expect(giftsCols).toContain('reconciliation_status');
    expect(giftsCols).toContain('is_thanked');
    expect(giftsCols).toContain('is_voided');
    expect(giftsCols).toContain('voided_reason');
    expect(giftsCols).toContain('version');

    const contribConfig = getTableConfig(giftContributors);
    expect(contribConfig.name).toBe('gift_contributors');
    const contribCols = contribConfig.columns.map((c) => c.name);
    expect(contribCols).toContain('gift_id');
    expect(contribCols).toContain('guest_id');
    expect(contribCols).toContain('contributor_name');
    expect(contribCols).toContain('relationship');

    const returnsConfig = getTableConfig(giftReturns);
    expect(returnsConfig.name).toBe('gift_returns');
    const returnsCols = returnsConfig.columns.map((c) => c.name);
    expect(returnsCols).toContain('gift_id');
    expect(returnsCols).toContain('amount');
    expect(returnsCols).toContain('return_reason');
    expect(returnsCols).toContain('returned_at');

    expect(giftTypeEnum.enumValues).toEqual(['cash', 'physical']);
    expect(reconciliationStatusEnum.enumValues).toEqual(['reconciled', 'needs_reconciliation']);
  });

  it('defines handover_packets and post_wedding_tasks tables', () => {
    const handoverConfig = getTableConfig(handoverPackets);
    expect(handoverConfig.name).toBe('handover_packets');
    const handoverCols = handoverConfig.columns.map((c) => c.name);
    expect(handoverCols).toContain('event_id');
    expect(handoverCols).toContain('version');
    expect(handoverCols).toContain('title');
    expect(handoverCols).toContain('scope');
    expect(handoverCols).toContain('snapshot_data');
    expect(handoverCols).toContain('handover_status');
    expect(handoverCols).toContain('is_shared_with_family');

    const postTasksConfig = getTableConfig(postWeddingTasks);
    expect(postTasksConfig.name).toBe('post_wedding_tasks');
    const postCols = postTasksConfig.columns.map((c) => c.name);
    expect(postCols).toContain('task_key');
    expect(postCols).toContain('is_completed');

    expect(handoverStatusEnum.enumValues).toEqual(['draft', 'handed_over']);
  });

  it('verifies attendance table includes live check-in fields', () => {
    const attConfig = getTableConfig(attendance);
    const attCols = attConfig.columns.map((c) => c.name);
    expect(attCols).toContain('is_checked_in');
    expect(attCols).toContain('check_in_time');
    expect(attCols).toContain('checked_in_by_user_id');
    expect(attCols).toContain('check_in_notes');
  });

  it('verifies events includes is_check_in_enabled and wedding_settings includes archival fields', () => {
    const eventConfig = getTableConfig(events);
    const eventCols = eventConfig.columns.map((c) => c.name);
    expect(eventCols).toContain('is_check_in_enabled');

    const settingsConfig = getTableConfig(weddingSettings);
    const settingsCols = settingsConfig.columns.map((c) => c.name);
    expect(settingsCols).toContain('is_archived');
    expect(settingsCols).toContain('archived_at');
    expect(settingsCols).toContain('archived_by_user_id');
    expect(settingsCols).toContain('archived_reason');
    expect(settingsCols).toContain('reopened_at');
    expect(settingsCols).toContain('reopened_by_user_id');
  });

  it('verifies migration 0005 SQL and journal file entry', () => {
    const sqlPath = path.resolve(process.cwd(), 'src/db/migrations/0005_gate_g10_schedule_gifts_handovers.sql');
    expect(fs.existsSync(sqlPath)).toBe(true);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    expect(sqlContent).toContain('CREATE TABLE "timeline_items"');
    expect(sqlContent).toContain('CREATE TABLE "gifts"');
    expect(sqlContent).toContain('CREATE TABLE "gift_contributors"');
    expect(sqlContent).toContain('CREATE TABLE "gift_returns"');
    expect(sqlContent).toContain('CREATE TABLE "handover_packets"');
    expect(sqlContent).toContain('CREATE TABLE "post_wedding_tasks"');
    expect(sqlContent).toContain('ALTER TABLE "attendance" ADD COLUMN "is_checked_in"');
    expect(sqlContent).toContain('ALTER TABLE "events" ADD COLUMN "is_check_in_enabled"');
    expect(sqlContent).toContain('ALTER TABLE "wedding_settings" ADD COLUMN "is_archived"');
    expect(sqlContent).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sqlContent).toContain('FORCE ROW LEVEL SECURITY');
    expect(sqlContent).toContain('family_select_timeline_items');
    expect(sqlContent).toContain('family_select_handover_packets');

    const journalPath = path.resolve(process.cwd(), 'src/db/migrations/meta/_journal.json');
    const journalContent = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const entry0005 = journalContent.entries.find((e: any) => e.tag === '0005_gate_g10_schedule_gifts_handovers');
    expect(entry0005).toBeDefined();
    expect(entry0005.idx).toBe(5);
  });
});
