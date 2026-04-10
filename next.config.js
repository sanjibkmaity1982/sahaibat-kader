/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbackRoutes: {
    document: "/offline",
  },
  workboxOptions: {
    runtimeCaching: [
      // App shell + triage pages — CacheFirst for instant offline access
      {
        urlPattern: /^\/$|^\/triage(\/.*)?$|^\/offline$/,
        handler: "CacheFirst",
        options: {
          cacheName: "sahaibat-pages-v1",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      // Static assets — JS, CSS, fonts, icons
      {
        urlPattern: /\.(?:js|css|woff2?|png|jpg|svg|ico)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "sahaibat-assets-v1",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      // Supabase API — NetworkFirst with offline fallback
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "sahaibat-api-v1",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
          networkTimeoutSeconds: 5,
        },
      },
    ],
  },
});

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sahaibat/growth-engine"],
};

module.exports = withPWA(nextConfig);
