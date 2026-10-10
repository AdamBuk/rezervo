"use client";

import { useMemo } from "react";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/ics";

type Props = {
  uid: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  location?: string | null;
  description?: string;
};

/** "Add to calendar" for the confirmation screen: Google Calendar link and an .ics file (Apple, Outlook…). */
export function AddToCalendar({ uid, title, startsAt, durationMinutes, location, description }: Props) {
  const event = useMemo<CalendarEvent>(() => {
    const start = new Date(startsAt);
    return {
      uid,
      title,
      start,
      end: new Date(start.getTime() + durationMinutes * 60_000),
      location,
      description,
    };
  }, [uid, title, startsAt, durationMinutes, location, description]);

  function downloadIcs() {
    const url = URL.createObjectURL(new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rezervace.ics";
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Přidat do kalendáře">
      <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className="btn-secondary">
        <CalendarIcon />
        Google Kalendář
      </a>
      <button type="button" onClick={downloadIcs} className="btn-secondary">
        <CalendarIcon />
        Apple / Outlook (.ics)
      </button>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 text-brand-700" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8.5h14M7 3v3M13 3v3" strokeLinecap="round" />
    </svg>
  );
}
