/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      // App shell routes — CacheFirst so they work immediately offline
      {
        urlPattern: /^\/$|^\/triage(\/.*)?$/,
        handler: "CacheFirst",
        options: {
          cacheName: "sahaibat-pages-v1",
          expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      // Static assets (JS, CSS, fonts, icons)
      {
        urlPattern: /\.(?:js|css|woff2?|png|jpg|svg|ico)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "sahaibat-assets-v1",
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // API calls — NetworkFirst with fallback
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "sahaibat-api-v1",
          expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
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
