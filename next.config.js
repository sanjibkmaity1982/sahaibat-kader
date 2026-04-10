/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https?.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "sahaibat-kader-v1",
          expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 4,
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
