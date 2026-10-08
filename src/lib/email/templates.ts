import { formatDuration, formatPrice } from "@/lib/format";
import { formatInTimeZone, formatTime } from "@/lib/time";
import type { EmailMessage } from "./send";

export type BookingEmailData = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  durationMinutes: number;
  priceCzk: number;
  startsAt: string;
  business: {
    name: string;
    slug: string;
    address: string | null;
    phone: string | null;
    timezone: string;
    notificationEmail: string;
  };
  siteUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function when(d: BookingEmailData, startsAt = d.startsAt) {
  const tz = d.business.timezone;
  const date = formatInTimeZone(startsAt, tz, { weekday: "long", day: "numeric", month: "long" });
  return `${date} v ${formatTime(startsAt, tz)}`;
}

/** Detail rows as [label, value] – rendered both to HTML and plain text. */
function detailRows(d: BookingEmailData): [string, string][] {
  const rows: [string, string][] = [
    ["Služba", d.serviceName],
    ["Termín", when(d)],
    ["Délka", formatDuration(d.durationMinutes)],
    ["Cena", formatPrice(d.priceCzk)],
  ];
  if (d.business.address) rows.push(["Adresa", d.business.address]);
  if (d.business.phone) rows.push(["Telefon", d.business.phone]);
  return rows;
}

function layout(opts: { heading: string; intro: string; rows?: [string, string][]; outro?: string; footer: string }) {
  const rows = (opts.rows ?? [])
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#78716c;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#1c1917;font-weight:600">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="cs"><body style="margin:0;background:#faf8f5;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px">
<tr><td style="padding:28px 28px 8px">
<h1 style="margin:0 0 12px;font-size:20px;color:#19675e">${escapeHtml(opts.heading)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escapeHtml(opts.intro)}</p>
${rows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px">${rows}</table>` : ""}
${opts.outro ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#57534e">${escapeHtml(opts.outro)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #f5f5f4;font-size:12px;color:#a8a29e">${escapeHtml(opts.footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    opts.heading,
    "",
    opts.intro,
    "",
    ...(opts.rows ?? []).map(([l, v]) => `${l}: ${v}`),
    ...(opts.outro ? ["", opts.outro] : []),
    "",
    "—",
    opts.footer,
  ].join("\n");

  return { html, text };
}

function customerFooter(d: BookingEmailData) {
  const contact = d.business.phone ? ` Pro změnu termínu volejte ${d.business.phone}.` : "";
  return `${d.business.name} · ${d.siteUrl}/${d.business.slug}.${contact}`;
}

export function bookingConfirmationEmail(d: BookingEmailData): EmailMessage {
  return {
    to: d.customerEmail,
    replyTo: d.business.notificationEmail,
    subject: `Potvrzení rezervace – ${d.business.name}, ${when(d)}`,
    ...layout({
      heading: "Rezervace je potvrzená",
      intro: `Dobrý den, ${d.customerName}, děkujeme za rezervaci v ${d.business.name}. Těšíme se na vás.`,
      rows: detailRows(d),
      outro: "Den před termínem vám pošleme připomínku. Pokud nemůžete přijít, dejte nám prosím vědět.",
      footer: customerFooter(d),
    }),
  };
}

export function ownerNotificationEmail(d: BookingEmailData): EmailMessage {
  return {
    to: d.business.notificationEmail,
    replyTo: d.customerEmail,
    subject: `Nová rezervace: ${d.customerName}, ${when(d)}`,
    ...layout({
      heading: "Máte novou rezervaci",
      intro: `${d.customerName} si právě zarezervoval(a) termín přes vaši rezervační stránku.`,
      rows: [
        ["Služba", d.serviceName],
        ["Termín", when(d)],
        ["Zákazník", d.customerName],
        ["E-mail", d.customerEmail],
        ["Telefon", d.customerPhone],
      ],
      outro: `Všechny rezervace najdete v kalendáři: ${d.siteUrl}/dashboard`,
      footer: "Rezervo – upozornění pro majitele podniku",
    }),
  };
}

export function reminderEmail(d: BookingEmailData): EmailMessage {
  return {
    to: d.customerEmail,
    replyTo: d.business.notificationEmail,
    subject: `Připomínka: zítra v ${formatTime(d.startsAt, d.business.timezone)} – ${d.business.name}`,
    ...layout({
      heading: "Zítra se vidíme",
      intro: `Dobrý den, ${d.customerName}, připomínáme vaši zítřejší rezervaci.`,
      rows: detailRows(d),
      outro: "Pokud nemůžete přijít, dejte nám prosím co nejdříve vědět.",
      footer: customerFooter(d),
    }),
  };
}

export function cancellationEmail(d: BookingEmailData): EmailMessage {
  return {
    to: d.customerEmail,
    replyTo: d.business.notificationEmail,
    subject: `Zrušení rezervace – ${d.business.name}, ${when(d)}`,
    ...layout({
      heading: "Rezervace byla zrušena",
      intro: `Dobrý den, ${d.customerName}, vaše rezervace (${d.serviceName}, ${when(d)}) byla zrušena.`,
      outro: `Nový termín si můžete vybrat na ${d.siteUrl}/${d.business.slug}.`,
      footer: customerFooter(d),
    }),
  };
}

export function rescheduleEmail(d: BookingEmailData, previousStartsAt: string): EmailMessage {
  return {
    to: d.customerEmail,
    replyTo: d.business.notificationEmail,
    subject: `Změna termínu – ${d.business.name}, nově ${when(d)}`,
    ...layout({
      heading: "Termín vaší rezervace se změnil",
      intro: `Dobrý den, ${d.customerName}, vaši rezervaci jsme přesunuli z ${when(d, previousStartsAt)} na nový termín.`,
      rows: detailRows(d),
      outro: "Pokud vám nový termín nevyhovuje, ozvěte se nám prosím.",
      footer: customerFooter(d),
    }),
  };
}
