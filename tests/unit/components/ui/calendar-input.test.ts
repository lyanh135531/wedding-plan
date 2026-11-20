import { describe, expect, it } from 'vitest';
import { calendarDateValue, calendarMonthDays, parseCalendarDate } from '@/components/ui/calendar-input';

describe('Calendar dates', () => {
  it.each(['2027-02-29', '2028-02-30', '2028-13-01', '2028-00-01', '2028-04-00', '15/03/2028', ''])('rejects invalid date %s without silently rolling over', value => {
    expect(parseCalendarDate(value)).toBeNull();
  });

  it('preserves leap days and uses local calendar fields without a UTC conversion', () => {
    const date = parseCalendarDate('2028-02-29')!;
    expect(calendarDateValue(date)).toBe('2028-02-29');
    expect(date.getHours()).toBe(0);
  });

  it('lays out six Monday-first weeks across a year boundary', () => {
    const days = calendarMonthDays(2027, 0);
    expect(days).toHaveLength(42);
    expect(new Set(days).size).toBe(42);
    expect(days[0]).toBe('2026-12-28');
    expect(days[41]).toBe('2027-02-07');
    expect(parseCalendarDate(days[0])!.getDay()).toBe(1);
  });

  it('includes February 29 only in leap years', () => {
    expect(calendarMonthDays(2028, 1)).toContain('2028-02-29');
    expect(calendarMonthDays(2027, 1)).not.toContain('2027-02-29');
  });
});
