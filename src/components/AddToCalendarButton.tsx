import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown, Download, ExternalLink } from 'lucide-react';
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
  surfaceColor,
  mutedColor,
}: AddToCalendarButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const googleUrl = useMemo(
    () => buildGoogleCalendarUrl(event, coupleNames),
    [event, coupleNames]
  );
  const iosDataUri = useMemo(
    () => buildIcsDataUri(event, coupleNames, slug),
    [event, coupleNames, slug]
  );
  const ios = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
        style={{ borderColor }}
      >
        <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
        Add to Calendar
        <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 bottom-full mb-2 w-60 rounded-xl border shadow-lg p-1.5 z-30 space-y-1"
          style={{
            backgroundColor: surfaceColor,
            borderColor,
          }}
        >
          <a
            role="menuitem"
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 hover:bg-black/5 transition-colors"
          >
            <span>Google Calendar</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
          </a>

          {ios ? (
            <a
              role="menuitem"
              href={iosDataUri}
              onClick={() => setOpen(false)}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 hover:bg-black/5 transition-colors"
            >
              <span>Apple / iOS Calendar</span>
              <CalendarPlus className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
            </a>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                downloadEventIcs(event, coupleNames, slug);
                setOpen(false);
              }}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 hover:bg-black/5 transition-colors cursor-pointer text-left"
            >
              <span>Apple / Outlook (.ics)</span>
              <Download className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
            </button>
          )}

          <p className="px-3 pt-1 pb-0.5 text-[11px]" style={{ color: mutedColor }}>
            Works on mobile &amp; desktop (IST)
          </p>
        </div>
      )}
    </div>
  );
}
