import { describe, it, expect } from 'vitest';
import { generateIcsCalendar } from '../../../src/lib/calendar/ics';

describe('RFC 5545 iCalendar (.ics) Generator (AT62)', () => {
  it('generates a valid RFC 5545 calendar with proper VEVENT structure and line folding', () => {
    const events = [
      {
        uid: 'event-1',
        title: 'Lễ Thành Hôn & Rước Dâu (Nhà Gái -> Nhà Trai)',
        description: 'Tập trung tại số 12 Võ Văn Tần; gia đình chuẩn bị sính lễ đầy đủ.',
        location: '12 Võ Văn Tần, Phường 6, Quận 3, TP. Hồ Chí Minh',
        startDate: new Date('2028-03-15T09:00:00.000Z'),
        endDate: new Date('2028-03-15T11:30:00.000Z'),
        allDay: false,
      },
      {
        uid: 'task-1',
        title: 'Gửi thiệp cưới cho bạn bè đồng nghiệp',
        startDate: new Date('2028-02-15T00:00:00.000Z'),
        allDay: true,
      },
    ];

    const ics = generateIcsCalendar(events);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Google Antigravity//Wedding Planner R1//VI');

    // Event 1 checks
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:event-1@wedding.local');
    expect(ics).toContain('DTSTART:20280315T090000Z');
    expect(ics).toContain('DTEND:20280315T113000Z');
    expect(ics).toContain('SUMMARY:Lễ Thành Hôn & Rước Dâu (Nhà Gái -> Nhà Trai)');
    expect(ics).toContain('LOCATION:12 Võ Văn Tần\\, Phường 6\\, Quận 3\\, TP. Hồ Chí Minh');

    // Event 2 (all-day task) checks
    expect(ics).toContain('UID:task-1@wedding.local');
    expect(ics).toContain('DTSTART;VALUE=DATE:20280215');
    expect(ics).toContain('DTEND;VALUE=DATE:20280215');

    expect(ics).toContain('END:VCALENDAR');
  });

  it('folds lines exceeding 75 characters per RFC 5545 §3.1', () => {
    const veryLongDescription = 'A'.repeat(200);
    const events = [
      {
        uid: 'ev-long',
        title: 'Tiêu đề ngắn',
        description: veryLongDescription,
        startDate: new Date('2028-03-15T09:00:00.000Z'),
      },
    ];

    const ics = generateIcsCalendar(events);
    const lines = ics.split('\r\n');

    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });
});
