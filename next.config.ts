import type { NextConfig } from "next";

// No third-party scripts or browser-side Supabase calls: everything is same-origin.
// 'unsafe-inline' scripts are needed for Next's hydration data and the theme init script
// (nonces would force dynamic rendering of the static landing page).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Dev server (React Refresh) needs eval; production doesn't.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  images: {
    // Marketing photos (Unsplash license), fetched at a fixed source size; see src/lib/photos.ts.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*", search: "?w=1600&q=80" }],
  },
  // Cache Components is intentionally disabled: almost every route reads the
  // auth cookie or live availability data, so classic dynamic rendering is simpler.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
