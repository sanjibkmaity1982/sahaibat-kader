/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  fallbackRoutes: {
    document: "/offline",
  },
  workboxOptions: {
    // Precache all app shell routes at SW install — works on Android Chrome
    additionalManifestEntries: [
      { url: "/", revision: "v4" },
      { url: "/triage", revision: "v4" },
      { url: "/triage/child", revision: "v4" },
      { url: "/triage/maternal", revision: "v4" },
      { url: "/triage/neonatal", revision: "v4" },
      { url: "/triage/postpartum", revision: "v4" },
      { url: "/offline", revision: "v4" },
    ],
    runtimeCaching: [
      // Pages — StaleWhileRevalidate so offline works AND online stays fresh
      {
        urlPattern: /^\/$|^\/triage(\/.*)?$|^\/offline$|^\/privacy$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "sahaibat-pages-v4",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
      // Static assets — CacheFirst, long TTL
      {
        urlPattern: /\.(?:js|css|woff2?|png|jpg|svg|ico)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "sahaibat-assets-v4",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      // Next.js static chunks
      {
        urlPattern: /\/_next\/static\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "sahaibat-next-static-v4",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      // Next.js image optimization
      {
        urlPattern: /\/_next\/image\?.*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "sahaibat-next-image-v4",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
      // Supabase API — NetworkFirst
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "sahaibat-api-v4",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60,
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
