import type { EventItem } from '../types/wedding';

function formatIcsDateTime(dateStr: string, timeStr: string): { start: string; end: string } {
  const cleanDate = (dateStr || '').replace(/-/g, '');
  if (!/^\d{8}$/.test(cleanDate)) {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    return { start: `${ymd}T100000`, end: `${ymd}T130000` };
  }

  let hours = 10;
  let minutes = 0;
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(timeStr || '');
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const meridiem = (match[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const endHours = (hours + 2) % 24;
  return {
    start: `${cleanDate}T${pad(hours)}${pad(minutes)}00`,
    end: `${cleanDate}T${pad(endHours)}${pad(minutes)}00`,
  };
}

function escapeIcsText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function downloadEventIcs(event: EventItem, coupleNames: string): void {
  const { start, end } = formatIcsDateTime(event.date, event.time);
  const uid = `${event.id}-${Date.now()}@manam.in`;
  const location = [event.venue, event.address].filter(Boolean).join(', ');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MANAM.in//Wedding Invitation//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;TZID=Asia/Kolkata:${start}`,
    `DTEND;TZID=Asia/Kolkata:${end}`,
    `SUMMARY:${escapeIcsText(`${coupleNames} — ${event.title}`)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(event.description || event.mapLink || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
