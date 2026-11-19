import { describe, expect, it } from 'vitest';
import { endOfWeddingDay, weddingDateKey } from '@/lib/dates';
import { computeEffectiveDueDate } from '@/lib/tasks/deadlines';

describe('Vietnamese business dates', () => {
  it('preserves a ceremony date at midnight in Vietnam', () => {
    expect(weddingDateKey('2027-01-10T00:00:00+07:00')).toBe('2027-01-10');
    expect(weddingDateKey('2027-01-09T18:00:00Z')).toBe('2027-01-10');
  });
  it('ends a calendar deadline at local midnight rather than seven hours later', () => {
    expect(endOfWeddingDay('2027-01-10').toISOString()).toBe('2027-01-10T16:59:59.999Z');
    const task = { deadlineType: 'fixed_date' as const, fixedDate: '2027-01-10', status: 'not_started' };
    expect(computeEffectiveDueDate(task, new Map(), new Date('2027-01-10T16:59:00Z')).isOverdue).toBe(false);
    expect(computeEffectiveDueDate(task, new Map(), new Date('2027-01-10T17:00:00Z')).isOverdue).toBe(true);
  });
});
