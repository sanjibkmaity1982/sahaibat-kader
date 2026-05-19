// app/VersionGuard.tsx
// Checks /api/version on mount and every 10 minutes.
// If the server build changed, forces the service worker to update and reloads.
// Silent — no UI unless a reload is triggered (shows a brief toast).

"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export default function VersionGuard() {
  const knownVersion = useRef<string | null>(null);
  const checking = useRef(false);

  useEffect(() => {
    async function checkVersion() {
      if (checking.current) return;
      checking.current = true;

      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        const serverVersion = data.version as string;

        if (!knownVersion.current) {
          // First check — just record the version, don't reload
          knownVersion.current = serverVersion;
          return;
        }

        if (serverVersion !== knownVersion.current) {
          console.log(
            `[VersionGuard] New deployment detected: ${knownVersion.current} → ${serverVersion}`
          );
          knownVersion.current = serverVersion;
          await forceServiceWorkerUpdate();
        }
      } catch {
        // Offline or network error — skip silently
      } finally {
        checking.current = false;
      }
    }

    // Check on mount (after short delay to not block initial render)
    const initialTimer = setTimeout(checkVersion, 5000);

    // Then check periodically
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    // Also check when coming back online
    const handleOnline = () => {
      setTimeout(checkVersion, 3000);
    };
    window.addEventListener("online", handleOnline);

    // Also check on visibility change (user switches back to the tab/app)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setTimeout(checkVersion, 2000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null; // No UI — purely background
}

async function forceServiceWorkerUpdate() {
  if (!("serviceWorker" in navigator)) {
    // No SW support — just hard reload
    window.location.reload();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      window.location.reload();
      return;
    }

    // Tell SW to check for updates
    await registration.update();

    // If there's a waiting worker, tell it to activate immediately
    const waiting = registration.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // Listen for the new SW to take control, then reload
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) {
        reloaded = true;
        console.log("[VersionGuard] New service worker active — reloading");
        window.location.reload();
      }
    });

    // Safety net: if controllerchange doesn't fire within 5s, reload anyway
    setTimeout(() => {
      if (!reloaded) {
        reloaded = true;
        console.log("[VersionGuard] Timeout waiting for SW — force reloading");
        window.location.reload();
      }
    }, 5000);
  } catch (err) {
    console.warn("[VersionGuard] SW update failed, reloading:", err);
    window.location.reload();
  }
}
