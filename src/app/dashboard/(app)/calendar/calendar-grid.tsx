import Link from "next/link";
import { isoWeekday, minutesToTime, timeToMinutes, toZoned } from "@/lib/time";
import { layoutLanes } from "@/lib/calendar-layout";

export type CalendarBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  serviceName: string;
  staffId: string;
  staffName: string;
};

/** One grid column: a day (week view) or a staff member (day view with a team). */
export type CalendarColumn = {
  key: string;
  /** Calendar day the column shows, "YYYY-MM-DD" */
  date: string;
  label: string;
  /** Date badge next to the label (day columns) */
  badge?: string;
  href?: string;
  highlight: boolean;
  /** Bookings belonging to this column */
  match: (booking: CalendarBooking) => boolean;
};

type Props = {
  columns: CalendarColumn[];
  timeZone: string;
  bookings: CalendarBooking[];
  hours: { weekday: number; opens_at: string; closes_at: string }[];
  /** Current local day and minutes since midnight in the business timezone */
  now: { date: string; minutes: number };
  bookingHref: (id: string) => string;
  selectedId: string | null;
  /** Show the staff member on blocks (week view of a team) */
  showStaff: boolean;
};

const HOUR_HEIGHT = 48; // px
const PX_PER_MIN = HOUR_HEIGHT / 60;

/** Pastel per service, so the same service always has the same color in the calendar. */
const SERVICE_TINTS = [
  "border-brand-500 bg-brand-100 text-brand-900",
  "border-sky-700 bg-sky-100 text-sky-700",
  "border-blush-700 bg-blush-100 text-blush-700",
  "border-sage-700 bg-sage-100 text-sage-700",
  "border-butter-700 bg-butter-100 text-butter-700",
] as const;

function serviceTint(serviceName: string): string {
  let hash = 0;
  for (const char of serviceName) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SERVICE_TINTS[hash % SERVICE_TINTS.length];
}

/** Time-grid calendar with bookings positioned by time; overlapping bookings sit side by side. */
export function CalendarGrid({ columns, timeZone, bookings, hours, now, bookingHref, selectedId, showStaff }: Props) {
  const placed = bookings.map((b) => {
    const start = toZoned(new Date(b.startsAt), timeZone);
    const durationMin = (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60_000;
    return { ...b, date: start.date, startMin: start.minutes, endMin: start.minutes + durationMin };
  });

  // Visible range: union of opening hours and bookings, rounded to whole hours.
  const relevantHours = hours.filter((h) => columns.some((c) => isoWeekday(c.date) === h.weekday));
  const starts = [...relevantHours.map((h) => timeToMinutes(h.opens_at)), ...placed.map((b) => b.startMin)];
  const ends = [...relevantHours.map((h) => timeToMinutes(h.closes_at)), ...placed.map((b) => b.endMin)];
  const firstHour = starts.length ? Math.floor(Math.min(...starts) / 60) : 8;
  const lastHour = ends.length ? Math.min(24, Math.ceil(Math.max(...ends) / 60)) : 18;
  const gridStart = firstHour * 60;
  const hourLabels = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const gridHeight = hourLabels.length * HOUR_HEIGHT;
  const template = { gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(0, 1fr))` };

  return (
    <div className="panel overflow-x-auto rounded-2xl">
      <div className={columns.length > 3 ? "min-w-[680px]" : columns.length > 1 ? "min-w-[420px]" : ""}>
        {/* Column headers */}
        <div className="grid border-b border-edge" style={template}>
          {/* Sticky so the time column stays visible when the grid scrolls sideways on phones */}
          <div className="sticky left-0 z-20 bg-surface" />
          {columns.map((c) => {
            const content = (
              <>
                <span className="font-semibold">{c.label}</span>
                {c.badge && (
                  <>
                    {" "}
                    <span className={`tabular-nums ${c.highlight ? "rounded-full bg-accent px-2 py-0.5 font-semibold text-white" : "text-stone-900"}`}>
                      {c.badge}
                    </span>
                  </>
                )}
              </>
            );
            const className = `block truncate border-l border-edge px-2 py-3 text-center text-sm ${c.highlight && c.badge ? "text-brand-700" : "text-stone-600"}`;
            return c.href ? (
              <Link key={c.key} href={c.href} className={`${className} transition-colors hover:bg-sand-50`}>
                {content}
              </Link>
            ) : (
              <div key={c.key} className={className}>
                {content}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="grid" style={template}>
          <div className="sticky left-0 z-20 bg-surface" style={{ height: gridHeight }}>
            {hourLabels.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-xs font-medium text-stone-500 tabular-nums" style={{ top: i * HOUR_HEIGHT }}>
                {i === 0 ? "" : `${h}:00`}
              </span>
            ))}
          </div>

          {columns.map((c) => {
            const opening = hours.find((h) => h.weekday === isoWeekday(c.date));
            const openTop = opening ? (timeToMinutes(opening.opens_at) - gridStart) * PX_PER_MIN : 0;
            const openHeight = opening ? (timeToMinutes(opening.closes_at) - timeToMinutes(opening.opens_at)) * PX_PER_MIN : 0;
            const columnBookings = layoutLanes(placed.filter((b) => b.date === c.date && c.match(b)));
            return (
              <div key={c.key} className="relative border-l border-edge bg-[repeating-linear-gradient(-45deg,transparent_0_6px,var(--color-sand-100)_6px_7px)]" style={{ height: gridHeight }}>
                {/* Opening hours background */}
                {opening && <div className="absolute inset-x-0 bg-surface" style={{ top: openTop, height: openHeight }} />}
                {/* Hour lines */}
                {hourLabels.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-edge/70" style={{ top: i * HOUR_HEIGHT }} />
                ))}
                {/* Current time */}
                {c.date === now.date && now.minutes >= gridStart && now.minutes <= lastHour * 60 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500"
                    style={{ top: (now.minutes - gridStart) * PX_PER_MIN }}
                    aria-hidden
                  >
                    <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-red-500" />
                  </div>
                )}
                {columnBookings.map((b) => {
                  const height = Math.max((b.endMin - b.startMin) * PX_PER_MIN - 2, 18);
                  const compact = height < 40;
                  const past = b.date < now.date || (b.date === now.date && b.endMin <= now.minutes);
                  const details = showStaff ? `${b.serviceName} · ${b.staffName}` : b.serviceName;
                  return (
                    <Link
                      key={b.id}
                      href={bookingHref(b.id)}
                      scroll={false}
                      className={`absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-xs transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-700 ${
                        b.id === selectedId
                          ? "border-accent-deep bg-accent text-white"
                          : past
                            ? "border-stone-300 bg-stone-100 text-stone-500 hover:bg-stone-200"
                            : `${serviceTint(b.serviceName)} hover:brightness-95`
                      }`}
                      style={{
                        top: (b.startMin - gridStart) * PX_PER_MIN + 1,
                        height,
                        left: `calc(${(b.lane / b.lanes) * 100}% + 4px)`,
                        width: `calc(${100 / b.lanes}% - 6px)`,
                      }}
                      title={`${minutesToTime(b.startMin)}–${minutesToTime(b.endMin)} ${b.customerName} – ${b.serviceName} (${b.staffName})${past ? " (proběhlo)" : ""}`}
                    >
                      <span className="block truncate">
                        <span className="font-semibold tabular-nums">{minutesToTime(b.startMin)}</span>{" "}
                        <span className="font-medium">{b.customerName}</span>
                      </span>
                      {!compact && <span className="block truncate opacity-80">{details}</span>}
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
