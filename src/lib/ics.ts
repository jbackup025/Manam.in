import type { EventItem } from '../types/wedding';

function parseEventUtcRange(dateStr: string, timeStr: string): { startUtc: string; endUtc: string } {
  let year: number;
  let month: number;
  let day: number;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    const parsed = Date.parse(dateStr || '');
    const fallback = Number.isFinite(parsed) ? new Date(parsed) : new Date();
    year = fallback.getUTCFullYear();
    month = fallback.getUTCMonth() + 1;
    day = fallback.getUTCDate();
  }

  let hours = 10;
  let minutes = 0;
  const timeMatch = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(timeStr || '');
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = (timeMatch[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    hours = Math.max(0, Math.min(23, hours));
    minutes = Math.max(0, Math.min(59, minutes));
  }

  // Interpret couple-entered event times in Asia/Kolkata (IST = UTC+05:30)
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const startMs = Date.UTC(year, month - 1, day, hours, minutes, 0) - istOffsetMs;
  const endMs = startMs + 2 * 60 * 60 * 1000;

  const toUtcStamp = (ms: number) =>
    new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  return {
    startUtc: toUtcStamp(startMs),
    endUtc: toUtcStamp(endMs),
  };
}

function escapeIcsText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildEventSummary(event: EventItem, coupleNames: string): string {
  return coupleNames ? `${coupleNames} — ${event.title}` : event.title;
}

function buildEventLocation(event: EventItem): string {
  return [event.venue, event.address].filter(Boolean).join(', ');
}

function buildEventDetails(event: EventItem): string {
  return [event.description, event.mapLink ? `Map: ${event.mapLink}` : '']
    .filter(Boolean)
    .join('\n\n');
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS Safari reports Macintosh with touch points
  return /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
}

export function buildGoogleCalendarUrl(event: EventItem, coupleNames: string): string {
  const { startUtc, endUtc } = parseEventUtcRange(event.date, event.time);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: buildEventSummary(event, coupleNames),
    dates: `${startUtc}/${endUtc}`,
    ctz: 'Asia/Kolkata',
    location: buildEventLocation(event),
    details: buildEventDetails(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsContent(event: EventItem, coupleNames: string, slug = 'wedding'): string {
  const { startUtc, endUtc } = parseEventUtcRange(event.date, event.time);
  const safeId = (event.id || event.title || 'event').replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeSlug = (slug || 'wedding').replace(/[^a-zA-Z0-9_-]/g, '-');
  const uid = `${safeSlug}-${safeId}@manam.in`;
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const sequence = Math.floor(Date.now() / 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MANAM.in//Wedding Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeIcsText(buildEventSummary(event, coupleNames))}`,
    `LOCATION:${escapeIcsText(buildEventLocation(event))}`,
    `DESCRIPTION:${escapeIcsText(buildEventDetails(event))}`,
    ...(event.mapLink ? [`URL:${event.mapLink}`] : []),
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function buildIcsDataUri(event: EventItem, coupleNames: string, slug = 'wedding'): string {
  const content = buildIcsContent(event, coupleNames, slug);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}

export function downloadEventIcs(event: EventItem, coupleNames: string, slug = 'wedding'): void {
  const content = buildIcsContent(event, coupleNames, slug);

  if (isIosDevice()) {
    window.location.assign(buildIcsDataUri(event, coupleNames, slug));
    return;
  }

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
