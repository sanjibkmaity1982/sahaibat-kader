"use client";

import { useEffect } from "react";

const ROUTES_TO_CACHE = [
  "/",
  "/triage",
  "/triage/child",
  "/triage/maternal",
  "/triage/neonatal",
  "/triage/postpartum",
  "/offline",
];

export default function CacheWarmup() {
  useEffect(() => {
    // Only run if online and service worker is supported
    if (!navigator.onLine || !("serviceWorker" in navigator)) return;

    // Wait 3 seconds after app load so it doesn't compete with initial render
    const timer = setTimeout(async () => {
      try {
        const cache = await caches.open("sahaibat-pages-v4");
        const existingKeys = await cache.keys();
        const cachedUrls = existingKeys.map((req) => new URL(req.url).pathname);

        for (const route of ROUTES_TO_CACHE) {
          if (!cachedUrls.includes(route)) {
            // Fetch and cache any route not already in cache
            try {
              const response = await fetch(route, { credentials: "same-origin" });
              if (response.ok) {
                await cache.put(route, response);
              }
            } catch {
              // Silently ignore individual fetch failures
            }
          }
        }
      } catch {
        // Silently ignore if caches API not available
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Renders nothing — purely a background effect
  return null;
}
