/**
 * RFC 5545 iCalendar (.ics) Generator
 * Generates standardized calendar feed for calendar apps (Apple Calendar, Google Calendar, Outlook).
 */

export interface IcsEventInput {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date;
  endDate?: Date | null;
  allDay?: boolean;
}

function formatIcsDate(date: Date, allDay = false): string {
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * Folds lines longer than 75 characters as specified in RFC 5545 §3.1
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;

  const parts: string[] = [];
  let remaining = line;

  parts.push(remaining.substring(0, 75));
  remaining = remaining.substring(75);

  while (remaining.length > 74) {
    parts.push(' ' + remaining.substring(0, 74));
    remaining = remaining.substring(74);
  }

  if (remaining.length > 0) {
    parts.push(' ' + remaining);
  }

  return parts.join('\r\n');
}

export function generateIcsCalendar(events: IcsEventInput[]): string {
  const now = new Date();
  const dtStamp = formatIcsDate(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Antigravity//Wedding Planner R1//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Lịch Kế Hoạch Đám Cưới',
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ];

  for (const ev of events) {
    const isAllDay = Boolean(ev.allDay);
    const startStr = isAllDay
      ? `DTSTART;VALUE=DATE:${formatIcsDate(ev.startDate, true)}`
      : `DTSTART:${formatIcsDate(ev.startDate)}`;

    const endDt = ev.endDate || (isAllDay ? ev.startDate : new Date(ev.startDate.getTime() + 3600000));
    const endStr = isAllDay
      ? `DTEND;VALUE=DATE:${formatIcsDate(endDt, true)}`
      : `DTEND:${formatIcsDate(endDt)}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}@wedding.local`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(startStr);
    lines.push(endStr);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);

    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }

    if (ev.location) {
      lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
