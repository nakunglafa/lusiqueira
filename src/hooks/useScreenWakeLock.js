"use client";

import { useEffect, useRef } from "react";

const WAKE_LOCK_KEY = "owner_keep_screen_on";

/**
 * Get the owner's "keep screen on" preference from localStorage.
 * Defaults to true so the screen stays on when the dashboard is open on mobile.
 */
export function getKeepScreenOnPreference() {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(WAKE_LOCK_KEY);
    if (v === null) return true;
    return v === "true";
  } catch {
    return true;
  }
}

/**
 * Set the owner's "keep screen on" preference (e.g. from Settings).
 */
export function setKeepScreenOnPreference(enabled) {
  try {
    localStorage.setItem(WAKE_LOCK_KEY, enabled ? "true" : "false");
  } catch {
    // ignore
  }
}

/**
 * useScreenWakeLock(enabled)
 * Uses the Screen Wake Lock API to prevent the device screen from dimming/locking
 * while the owner dashboard is open. Works on Chrome for Android and other supporting browsers.
 * When the tab is hidden, the lock is released; when visible again, it is re-acquired.
 * @param {boolean} enabled - Whether to keep the screen on (e.g. from user setting).
 */
export function useScreenWakeLock(enabled) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.wakeLock) return;

    const requestLock = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinelRef.current = await navigator.wakeLock.request("screen");
        sentinelRef.current.addEventListener("release", () => {
          sentinelRef.current = null;
        });
      } catch (err) {
        // e.g. not in secure context, low battery, or user denied
        if (process.env.NODE_ENV !== "production") {
          console.warn("Screen Wake Lock could not be acquired:", err?.message);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") requestLock();
    };

    requestLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };
  }, [enabled]);
}
