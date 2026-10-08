import Link from "next/link";
import { WEEKDAYS } from "@/lib/constants";
import { isoWeekday, minutesToTime, timeToMinutes, toZoned } from "@/lib/time";

export type CalendarBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  serviceName: string;
};

type Props = {
  days: string[];
  today: string;
  timeZone: string;
  bookings: CalendarBooking[];
  hours: { weekday: number; opens_at: string; closes_at: string }[];
  bookingHref: (id: string) => string;
  dayHref: (date: string) => string;
  selectedId: string | null;
};

const HOUR_HEIGHT = 56; // px
const PX_PER_MIN = HOUR_HEIGHT / 60;

/** Time-grid calendar (one column per day) with bookings positioned by time. */
export function CalendarGrid({ days, today, timeZone, bookings, hours, bookingHref, dayHref, selectedId }: Props) {
  const placed = bookings.map((b) => {
    const start = toZoned(new Date(b.startsAt), timeZone);
    const durationMin = (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60_000;
    return { ...b, date: start.date, startMin: start.minutes, endMin: start.minutes + durationMin };
  });

  // Visible range: union of opening hours and bookings, rounded to whole hours.
  const relevantHours = hours.filter((h) => days.some((d) => isoWeekday(d) === h.weekday));
  const starts = [...relevantHours.map((h) => timeToMinutes(h.opens_at)), ...placed.map((b) => b.startMin)];
  const ends = [...relevantHours.map((h) => timeToMinutes(h.closes_at)), ...placed.map((b) => b.endMin)];
  const firstHour = starts.length ? Math.floor(Math.min(...starts) / 60) : 8;
  const lastHour = ends.length ? Math.min(24, Math.ceil(Math.max(...ends) / 60)) : 18;
  const gridStart = firstHour * 60;
  const hourLabels = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const gridHeight = hourLabels.length * HOUR_HEIGHT;

  const isWeek = days.length > 1;

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <div className={isWeek ? "min-w-[760px]" : ""}>
        {/* Day headers */}
        <div className="grid border-b border-stone-200" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => {
            const wd = WEEKDAYS[isoWeekday(d) - 1];
            const isToday = d === today;
            const [, m, day] = d.split("-").map(Number);
            return (
              <Link
                key={d}
                href={dayHref(d)}
                className={`border-l border-stone-100 px-2 py-2 text-center text-sm hover:bg-stone-50 ${isToday ? "text-brand-700" : "text-stone-600"}`}
              >
                <span className="font-medium">{isWeek ? wd.short : wd.label}</span>{" "}
                <span className={`font-semibold ${isToday ? "rounded-full bg-brand-700 px-1.5 text-white" : "text-stone-900"}`}>
                  {day}. {m}.
                </span>
              </Link>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}>
          <div className="relative" style={{ height: gridHeight }}>
            {hourLabels.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-xs text-stone-400 tabular-nums" style={{ top: i * HOUR_HEIGHT }}>
                {i === 0 ? "" : `${h}:00`}
              </span>
            ))}
          </div>

          {days.map((d) => {
            const opening = hours.find((h) => h.weekday === isoWeekday(d));
            const openTop = opening ? (timeToMinutes(opening.opens_at) - gridStart) * PX_PER_MIN : 0;
            const openHeight = opening ? (timeToMinutes(opening.closes_at) - timeToMinutes(opening.opens_at)) * PX_PER_MIN : 0;
            return (
              <div key={d} className="relative border-l border-stone-100 bg-stone-50/70" style={{ height: gridHeight }}>
                {/* Opening hours background */}
                {opening && <div className="absolute inset-x-0 bg-white" style={{ top: openTop, height: openHeight }} />}
                {/* Hour lines */}
                {hourLabels.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-stone-100" style={{ top: i * HOUR_HEIGHT }} />
                ))}
                {placed
                  .filter((b) => b.date === d)
                  .map((b) => {
                    const height = Math.max((b.endMin - b.startMin) * PX_PER_MIN - 2, 18);
                    const compact = height < 40;
                    return (
                      <Link
                        key={b.id}
                        href={bookingHref(b.id)}
                        scroll={false}
                        className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs shadow-xs transition-colors ${
                          b.id === selectedId
                            ? "border-brand-900 bg-brand-700 text-white"
                            : "border-brand-600 bg-brand-100 text-brand-950 hover:bg-brand-200"
                        }`}
                        style={{ top: (b.startMin - gridStart) * PX_PER_MIN + 1, height }}
                        title={`${minutesToTime(b.startMin)} ${b.customerName} – ${b.serviceName}`}
                      >
                        <span className="block truncate">
                          <span className="font-semibold tabular-nums">{minutesToTime(b.startMin)}</span>{" "}
                          <span className="font-medium">{b.customerName}</span>
                        </span>
                        {!compact && <span className="block truncate opacity-80">{b.serviceName}</span>}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
