/**
 * Static, decorative product screenshots for the marketing pages, built in markup so they stay sharp,
 * follow the theme and need no image assets. Always rendered aria-hidden.
 */

type Tint = "brand" | "sky" | "blush" | "sage" | "butter";

const TINTS: Record<Tint, string> = {
  brand: "border-brand-500 bg-brand-100 text-brand-900",
  sky: "border-sky-700 bg-sky-100 text-sky-700",
  blush: "border-blush-700 bg-blush-100 text-blush-700",
  sage: "border-sage-700 bg-sage-100 text-sage-700",
  butter: "border-butter-700 bg-butter-100 text-butter-700",
};

type Appointment = { start: number; length: number; name: string; service: string; tint: Tint };

/** One week in the owner's calendar, mirroring the real week view (one column per day). */
const WEEK: { day: string; date: string; today?: boolean; closed?: boolean; appointments: Appointment[] }[] = [
  {
    day: "Po",
    date: "13. 10.",
    appointments: [
      { start: 0, length: 1, name: "Jana Vávrová", service: "Dámský střih", tint: "blush" },
      { start: 1.5, length: 2, name: "Blanka Šimková", service: "Barvení", tint: "brand" },
      { start: 5, length: 0.5, name: "Petr Kolář", service: "Pánský střih", tint: "sky" },
    ],
  },
  {
    day: "Út",
    date: "14. 10.",
    today: true,
    appointments: [
      { start: 0.5, length: 2.5, name: "Tereza Holubová", service: "Melír", tint: "brand" },
      { start: 3.5, length: 0.5, name: "Jakub Horák", service: "Pánský střih", tint: "sky" },
      { start: 4.5, length: 1, name: "Marie Nováková", service: "Dámský střih", tint: "blush" },
    ],
  },
  {
    day: "St",
    date: "15. 10.",
    appointments: [
      { start: 1, length: 1, name: "Eva Veselá", service: "Dámský střih", tint: "blush" },
      { start: 3, length: 1.5, name: "Lucie Dvořáková", service: "Společenský účes", tint: "butter" },
    ],
  },
  {
    day: "Čt",
    date: "16. 10.",
    appointments: [
      { start: 0, length: 0.5, name: "Ondřej Marek", service: "Pánský střih", tint: "sky" },
      { start: 1, length: 2, name: "Kateřina Procházková", service: "Barvení", tint: "brand" },
      { start: 4, length: 1, name: "Anna Krejčí", service: "Foukaná", tint: "sage" },
    ],
  },
  {
    day: "Pá",
    date: "17. 10.",
    appointments: [
      { start: 0.5, length: 1, name: "Veronika Malá", service: "Dámský střih", tint: "blush" },
      { start: 2, length: 0.5, name: "Lukáš Pospíšil", service: "Pánský střih", tint: "sky" },
      { start: 3, length: 2.5, name: "Klára Nová", service: "Melír", tint: "brand" },
    ],
  },
  {
    day: "So",
    date: "18. 10.",
    appointments: [{ start: 0, length: 1.5, name: "Barbora Pokorná", service: "Společenský účes", tint: "butter" }],
  },
  { day: "Ne", date: "19. 10.", closed: true, appointments: [] },
];

const HOURS = ["9:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
const ROW = 3; // rem per hour
const NOW = 2.25; // hours after the first row, for the current-time line

/** Desktop screenshot of the owner's week view: one column per day, bookings placed by time. */
export function CalendarMockup() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-edge bg-surface text-left shadow-(--shadow-float) select-none">
      {/* Toolbar, as in the dashboard */}
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <span className="grid size-7 place-items-center rounded-full border border-edge text-xs">←</span>
        <span className="rounded-full border border-edge px-3 py-1 text-xs font-semibold">Dnes</span>
        <span className="grid size-7 place-items-center rounded-full border border-edge text-xs">→</span>
        <span className="ml-2 font-display text-base font-bold tracking-tight">13. 10. – 19. 10.</span>
        <div className="ml-auto flex rounded-full border border-edge p-0.5 text-xs font-semibold">
          <span className="px-3 py-1 text-stone-500">Den</span>
          <span className="rounded-full bg-ink px-3 py-1 text-on-ink">Týden</span>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="min-w-[40rem]">
          {/* Day headers */}
          <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-edge">
            <span />
            {WEEK.map((d) => (
              <div key={d.day} className="border-l border-edge py-2.5 text-center text-xs">
                <span className={`font-semibold ${d.today ? "text-brand-600" : "text-stone-500"}`}>{d.day}</span>{" "}
                <span className={`tabular-nums ${d.today ? "rounded-full bg-accent px-1.5 py-0.5 font-semibold text-white" : "text-stone-900"}`}>
                  {d.date}
                </span>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[3rem_repeat(7,1fr)]" style={{ height: `${HOURS.length * ROW}rem` }}>
            <div className="relative">
              {HOURS.map((h, i) => (
                <span key={h} className="absolute right-2 text-[0.625rem] font-medium text-stone-400 tabular-nums" style={{ top: `${i * ROW + 0.25}rem` }}>
                  {h}
                </span>
              ))}
            </div>
            {WEEK.map((d) => (
              <div
                key={d.day}
                className={`relative border-l border-edge ${d.closed ? "bg-[repeating-linear-gradient(-45deg,transparent_0_6px,var(--color-sand-100)_6px_8px)]" : ""}`}
              >
                {HOURS.map((h, i) => (
                  <span key={h} className="absolute inset-x-0 border-t border-edge/70" style={{ top: `${i * ROW}rem` }} />
                ))}
                {d.today && (
                  <span className="absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: `${NOW * ROW}rem` }}>
                    <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-red-500" />
                  </span>
                )}
                {d.appointments.map((a) => (
                  <div
                    key={a.name}
                    className={`absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 ${TINTS[a.tint]}`}
                    style={{ top: `${a.start * ROW + 0.125}rem`, height: `${a.length * ROW - 0.25}rem` }}
                  >
                    <p className="truncate text-[0.6875rem] leading-tight font-semibold">{a.name}</p>
                    {a.length >= 1 && <p className="truncate text-[0.625rem] leading-tight opacity-80">{a.service}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PHONE_TIMES = ["9:00", "9:30", "10:30", "11:00", "13:00", "14:30"];

/** Phone screenshot of the public booking page. */
export function PhoneMockup({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`w-56 rounded-[2.25rem] border-[6px] border-ink bg-surface p-3 text-left shadow-(--shadow-float) select-none ${className}`}>
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-stone-200" />
      <p className="text-[0.625rem] font-semibold text-stone-500">rezervo.cz/u-nuzek</p>
      <p className="mt-1 font-display text-base leading-tight font-bold tracking-tight">Kadeřnictví U Nůžek</p>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between rounded-lg border-2 border-ink px-2.5 py-2">
          <span className="text-[0.6875rem] font-semibold">Dámský střih</span>
          <span className="text-[0.6875rem] font-semibold">650 Kč</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-edge px-2.5 py-2">
          <span className="text-[0.6875rem] font-medium">Barvení</span>
          <span className="text-[0.6875rem] font-medium text-stone-500">1 450 Kč</span>
        </div>
      </div>
      <p className="mt-3 text-[0.625rem] font-semibold">Út 14. října</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {PHONE_TIMES.map((t) => (
          <span
            key={t}
            className={`rounded-md py-1.5 text-center text-[0.625rem] font-semibold ${t === "13:00" ? "bg-accent text-white" : "bg-sand-100 text-stone-700"}`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-full bg-ink py-2 text-center text-[0.6875rem] font-semibold text-on-ink">Rezervovat</div>
    </div>
  );
}
