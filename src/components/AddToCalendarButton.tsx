import { useMemo } from 'react';
import { CalendarPlus, Download, ExternalLink } from 'lucide-react';
import {
  buildGoogleCalendarUrl,
  buildIcsDataUri,
  downloadEventIcs,
  isIosDevice,
} from '../lib/ics';
import type { EventItem } from '../types/wedding';

interface AddToCalendarButtonProps {
  slug: string;
  event: EventItem;
  coupleNames: string;
  borderColor: string;
  surfaceColor: string;
  mutedColor: string;
}

export function AddToCalendarButton({
  slug,
  event,
  coupleNames,
  borderColor,
}: AddToCalendarButtonProps) {
  const invitationUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    return `${window.location.origin}/wedding/${slug}`;
  }, [slug]);

  const googleUrl = useMemo(
    () => buildGoogleCalendarUrl(event, coupleNames, invitationUrl),
    [event, coupleNames, invitationUrl]
  );

  const iosDataUri = useMemo(
    () => buildIcsDataUri(event, coupleNames, slug, invitationUrl),
    [event, coupleNames, slug, invitationUrl]
  );

  const ios = useMemo(() => isIosDevice(), []);

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-85 transition-opacity"
        style={{ borderColor }}
      >
        <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
        Sync to Google Calendar
        <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
      </a>

      {ios ? (
        <a
          href={iosDataUri}
          className="min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-85 transition-opacity"
          style={{ borderColor }}
        >
          <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
          Apple / iOS Calendar
        </a>
      ) : (
        <button
          type="button"
          onClick={() => downloadEventIcs(event, coupleNames, slug, invitationUrl)}
          className="min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
          style={{ borderColor }}
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Apple / iOS (.ics)
        </button>
      )}
    </div>
  );
}
