import { describe, it, expect } from 'vitest';
import { createMockG10TxDb } from '../../helpers/g10-mock-db';
import {
  createTimelineItem,
  updateTimelineItem,
  markActualTimes,
  deleteTimelineItem,
  listTimelineItems,
  previewDelayShift,
  applyDelayShift,
  getTodayTimeline,
  detectPersonnelConflicts,
} from '@/lib/timeline';
import {
  TimelineTimeOrderError,
  TimelineItemNotFoundError,
  OptimisticLockError,
  InvalidTimelineShiftError,
} from '@/lib/timeline/errors';

describe('Gate G10: Timeline Service & Operations (PLAN §14.1, AT34, FL15)', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';

  it('creates and lists timeline milestones successfully', async () => {
    const db = createMockG10TxDb();
    const created = await createTimelineItem(db, {
      eventId,
      title: 'Lễ Gia Tiên Nhà Gái',
      category: 'ancestor_ceremony',
      scheduledStartTime: '2028-11-20T08:00:00Z',
      scheduledEndTime: '2028-11-20T09:30:00Z',
      locationName: 'Tư gia Nhà Gái',
      personInCharge: 'Trưởng đoàn',
      inChargePhone: '0901234567',
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Lễ Gia Tiên Nhà Gái');
    expect(created.status).toBe('not_started');
    expect(created.version).toBe(1);

    const list = await listTimelineItems(db, eventId);
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Lễ Gia Tiên Nhà Gái');
  });

  it('rejects creation when scheduledEndTime is before scheduledStartTime', async () => {
    const db = createMockG10TxDb();
    await expect(
      createTimelineItem(db, {
        eventId,
        title: 'Sai thứ tự giờ',
        scheduledStartTime: '2028-11-20T10:00:00Z',
        scheduledEndTime: '2028-11-20T09:00:00Z',
      })
    ).rejects.toThrow(TimelineTimeOrderError);
  });

  it('preserves planned scheduled times strictly immutable when marking actual times (AT34)', async () => {
    const db = createMockG10TxDb();
    const item = await createTimelineItem(db, {
      eventId,
      title: 'Lễ Khai Tiệc',
      category: 'ceremony',
      scheduledStartTime: '2028-11-20T18:00:00Z',
      scheduledEndTime: '2028-11-20T18:45:00Z',
    });

    // Mark actual start at 18:15 (started late by 15 mins)
    const markedStart = await markActualTimes(db, item.id, {
      actualStartTime: '2028-11-20T18:15:00Z',
      version: 1,
    });

    // Planned times MUST remain exactly unchanged (AT34)
    expect(markedStart.scheduledStartTime).toBe(new Date('2028-11-20T18:00:00Z').toISOString());
    expect(markedStart.scheduledEndTime).toBe(new Date('2028-11-20T18:45:00Z').toISOString());
    expect(markedStart.actualStartTime).toBe(new Date('2028-11-20T18:15:00Z').toISOString());
    expect(markedStart.status).toBe('in_progress');
    expect(markedStart.version).toBe(2);

    // Mark actual completion at 19:10
    const markedEnd = await markActualTimes(db, item.id, {
      actualEndTime: '2028-11-20T19:10:00Z',
      version: 2,
    });

    expect(markedEnd.scheduledStartTime).toBe(new Date('2028-11-20T18:00:00Z').toISOString());
    expect(markedEnd.scheduledEndTime).toBe(new Date('2028-11-20T18:45:00Z').toISOString());
    expect(markedEnd.actualStartTime).toBe(new Date('2028-11-20T18:15:00Z').toISOString());
    expect(markedEnd.actualEndTime).toBe(new Date('2028-11-20T19:10:00Z').toISOString());
    expect(markedEnd.status).toBe('completed');
  });

  it('detects personnel conflicts between parallel overlapping milestones', () => {
    const items = [
      {
        id: '1',
        title: 'Trang điểm cô dâu',
        scheduledStartTime: '2028-11-20T06:00:00Z',
        scheduledEndTime: '2028-11-20T07:30:00Z',
        personInCharge: 'Chị Mai Phù Dâu',
      },
      {
        id: '2',
        title: 'Kiểm tra hoa cưới tại sảnh',
        scheduledStartTime: '2028-11-20T07:00:00Z',
        scheduledEndTime: '2028-11-20T08:00:00Z',
        personInCharge: 'Chị Mai Phù Dâu',
      },
    ];

    const conflicts = detectPersonnelConflicts(items);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].itemAId).toBe('1');
    expect(conflicts[0].itemBId).toBe('2');
    expect(conflicts[0].personName).toBe('Chị Mai Phù Dâu');
  });

  it('previews and applies selective delay rescheduling only to unstarted milestones (FL15)', async () => {
    const db = createMockG10TxDb();
    // Milestone 1: completed
    const m1 = await createTimelineItem(db, {
      eventId,
      title: 'Đón dâu',
      scheduledStartTime: '2028-11-20T07:00:00Z',
      scheduledEndTime: '2028-11-20T08:00:00Z',
    });
    await updateTimelineItem(db, m1.id, { status: 'completed', version: 1 });

    // Milestone 2: in_progress
    const m2 = await createTimelineItem(db, {
      eventId,
      title: 'Lễ gia tiên',
      scheduledStartTime: '2028-11-20T08:00:00Z',
      scheduledEndTime: '2028-11-20T09:00:00Z',
    });
    await updateTimelineItem(db, m2.id, { status: 'in_progress', version: 1 });

    // Milestone 3: not_started
    const m3 = await createTimelineItem(db, {
      eventId,
      title: 'Chụp hình kỷ niệm',
      scheduledStartTime: '2028-11-20T09:00:00Z',
      scheduledEndTime: '2028-11-20T10:00:00Z',
    });

    // Milestone 4: not_started
    const m4 = await createTimelineItem(db, {
      eventId,
      title: 'Dùng tiệc trưa',
      scheduledStartTime: '2028-11-20T10:30:00Z',
      scheduledEndTime: '2028-11-20T12:00:00Z',
    });

    // Preview +30 min delay starting from 08:30
    const preview = await previewDelayShift(db, {
      eventId,
      delayMinutes: 30,
      pivotTime: '2028-11-20T08:30:00Z',
    });

    // Only m3 and m4 should be affected (m1 completed, m2 in_progress are excluded!)
    expect(preview.affectedCount).toBe(2);
    expect(preview.affectedItems.map((a) => a.id)).toEqual([m3.id, m4.id]);
    expect(preview.affectedItems[0].newStart).toBe(new Date('2028-11-20T09:30:00Z').toISOString());
    expect(preview.affectedItems[1].newStart).toBe(new Date('2028-11-20T11:00:00Z').toISOString());

    // Apply shift
    await applyDelayShift(db, {
      eventId,
      delayMinutes: 30,
      pivotTime: '2028-11-20T08:30:00Z',
      confirmed: true,
    });

    const list = await listTimelineItems(db, eventId);
    const updatedM1 = list.find((i) => i.id === m1.id)!;
    const updatedM2 = list.find((i) => i.id === m2.id)!;
    const updatedM3 = list.find((i) => i.id === m3.id)!;
    const updatedM4 = list.find((i) => i.id === m4.id)!;

    // Completed & in_progress unchanged
    expect(updatedM1.scheduledStartTime).toBe(new Date('2028-11-20T07:00:00Z').toISOString());
    expect(updatedM2.scheduledStartTime).toBe(new Date('2028-11-20T08:00:00Z').toISOString());
    // Not started items shifted by +30m
    expect(updatedM3.scheduledStartTime).toBe(new Date('2028-11-20T09:30:00Z').toISOString());
    expect(updatedM4.scheduledStartTime).toBe(new Date('2028-11-20T11:00:00Z').toISOString());
  });

  it('correctly calculates dynamic delay badges and groups items in Today View (UXT15)', async () => {
    const db = createMockG10TxDb();
    // Planned 08:00, wall clock is 08:20, item not started -> delayed by 20 mins!
    const m1 = await createTimelineItem(db, {
      eventId,
      title: 'Đón khách',
      scheduledStartTime: '2028-11-20T08:00:00Z',
      scheduledEndTime: '2028-11-20T09:00:00Z',
    });

    // Item upcoming at 10:00
    const m2 = await createTimelineItem(db, {
      eventId,
      title: 'Làm lễ',
      scheduledStartTime: '2028-11-20T10:00:00Z',
      scheduledEndTime: '2028-11-20T11:00:00Z',
    });

    const wallClock = new Date('2028-11-20T08:20:00Z');
    const today = await getTodayTimeline(db, eventId, wallClock);

    expect(today.delayed.length).toBe(1);
    expect(today.delayed[0].id).toBe(m1.id);
    expect((today.delayed[0] as any).delayMinutes).toBe(20);

    expect(today.next.length).toBe(1);
    expect(today.next[0].id).toBe(m2.id);
  });
});
