"use client";

import { createContext, useContext, useCallback, useEffect, useRef } from "react";
import { EVENTS } from "@/context/RealTimeNotificationContext";

const OwnerRefreshContext = createContext(null);

/**
 * Provider for owner dashboard. Listens for real-time notifications (new order, new reservation)
 * at layout level and triggers all registered refresh callbacks.
 * Use registerRefresh(loadData) in any owner page to refresh when notifications arrive.
 */
export function OwnerRefreshProvider({ children }) {
  const listenersRef = useRef(new Set());

  const registerRefresh = useCallback((fn) => {
    if (typeof fn !== "function") return () => {};
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const triggerRefresh = useCallback(() => {
    listenersRef.current.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[OwnerRefresh] Refresh callback error:", e);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNotify = () => triggerRefresh();
    window.addEventListener(EVENTS.NEW_RESERVATION, onNotify);
    window.addEventListener(EVENTS.NEW_ORDER, onNotify);
    window.addEventListener(EVENTS.RESERVATION_UPDATED, onNotify);
    window.addEventListener(EVENTS.ORDER_UPDATED, onNotify);
    return () => {
      window.removeEventListener(EVENTS.NEW_RESERVATION, onNotify);
      window.removeEventListener(EVENTS.NEW_ORDER, onNotify);
      window.removeEventListener(EVENTS.RESERVATION_UPDATED, onNotify);
      window.removeEventListener(EVENTS.ORDER_UPDATED, onNotify);
    };
  }, [triggerRefresh]);

  return (
    <OwnerRefreshContext.Provider value={{ registerRefresh }}>
      {children}
    </OwnerRefreshContext.Provider>
  );
}

export function useOwnerRefresh() {
  return useContext(OwnerRefreshContext) ?? { registerRefresh: () => () => {} };
}
