import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
