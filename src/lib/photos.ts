/** Marketing photography (Unsplash license). The URL shape must match `images.remotePatterns` in next.config.ts. */
export type Photo = { src: string; alt: string };

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=80`;

export const PHOTOS = {
  stylist: {
    src: unsplash("1562322140-8baeececf3df"),
    alt: "Usměvavá kadeřnice fénuje zákaznici vlasy ve světlém salonu",
  },
  curls: {
    src: unsplash("1560869713-7d0a29430803"),
    alt: "Kadeřnice vytváří kulmou vlny na dlouhých hnědých vlasech",
  },
  barber: {
    src: unsplash("1503951914875-452162b0f3f1"),
    alt: "Zákazník v holičském křesle v barbershopu",
  },
  massage: {
    src: unsplash("1519823551278-64ac92734fb1"),
    alt: "Masérka masíruje zákaznici záda",
  },
  physio: {
    src: unsplash("1645005512968-0c1fe99f0093"),
    alt: "Fyzioterapeut vyšetřuje pacientovi rameno",
  },
  stones: {
    src: unsplash("1600334089648-b0d9d3028eb2"),
    alt: "Masáž lávovými kameny, na zádech leží řada černých kamenů",
  },
} as const satisfies Record<string, Photo>;
