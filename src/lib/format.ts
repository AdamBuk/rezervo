import { RESERVED_SLUGS } from "./constants";

/** "Kadeřnictví U Nůžek" → "kadernictvi-u-nuzek" */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export function validateSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 60) return "Adresa musí mít 3 až 60 znaků.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Adresa může obsahovat jen malá písmena bez diakritiky, číslice a pomlčky.";
  if (RESERVED_SLUGS.includes(slug)) return "Tuto adresu nelze použít, zvolte jinou.";
  return null;
}

const priceFormatter = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });

export function formatPrice(czk: number): string {
  return priceFormatter.format(czk);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "09:00:00" → "09:00" */
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

export function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
