"use client";

import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { isOwner } from "@/lib/owner-utils";
import { createEcho } from "@/lib/echo";
import { getMyRestaurants } from "@/lib/api";

const RealTimeNotificationContext = createContext(null);
const DEBUG = typeof process !== "undefined" && process.env.NODE_ENV === "development";

/** Custom event names dispatched to window for toast display */
export const EVENTS = {
  NEW_RESERVATION: "owner-new-reservation",
  RESERVATION_UPDATED: "owner-reservation-updated",
  NEW_ORDER: "owner-new-order",
  ORDER_UPDATED: "owner-order-updated",
};

/**
 * Provider that starts real-time notification listeners when an owner is logged in.
 * Subscribes to:
 * - private-App.Models.User.{userId} — NewReservationNotification, OrderCreated
 * - private-restaurant.{id} — ReservationCreated, ReservationUpdated, OrderCreated (per restaurant)
 *
 * Per API docs: auth endpoint is {API_URL}/broadcasting/auth (e.g. /api/broadcasting/auth).
 */
export function RealTimeNotificationProvider({ children }) {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth();
  const echoRef = useRef(null);
  const userChannelRef = useRef(null);
  const restaurantChannelsRef = useRef([]);

  /**
   * Clean up a specific Echo instance. Pass the instance to avoid disconnecting
   * a newly created one when Fast Refresh re-runs the effect (old cleanup would
   * otherwise use echoRef.current which may already point to the new instance).
   */
  const cleanupEcho = useCallback((echoInstance, channels, userCh) => {
    if (!echoInstance) return;
    try {
      (channels || []).forEach((ch) => {
        try {
          if (ch?.name) echoInstance.leave("private-" + ch.name);
        } catch (_) {}
      });
      if (userCh) {
        try {
          userCh.stopListening("NewReservationNotification");
          userCh.stopListening("NewReservation");
          userCh.stopListening("ReservationCreated");
          userCh.stopListening("OrderCreated");
          userCh.stopListening("NewOrderNotification");
          userCh.stopListening("order.created");
          userCh.stopListening(".OrderCreated");
          userCh.stopListeningForNotification(() => {});
        } catch (_) {}
      }
      echoInstance.disconnect();
    } catch (err) {
      if (DEBUG) console.error("[Notifications] Disconnect error:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Wait for auth to be fully resolved (token validated via getCurrentUser)
    if (authLoading) {
      if (DEBUG) console.log("[Notifications] Waiting for auth to load...");
      return;
    }
    if (!isAuthenticated || !token || !user || !user.id || !isOwner(user)) {
      if (DEBUG && isAuthenticated && user && !isOwner(user)) {
        console.log("[Notifications] User is not owner/super-admin, skipping:", user.role ?? user.role_id);
      }
      const prevEcho = echoRef.current;
      const prevChannels = [...restaurantChannelsRef.current];
      const prevUserCh = userChannelRef.current;
      echoRef.current = null;
      userChannelRef.current = null;
      restaurantChannelsRef.current = [];
      if (prevEcho) cleanupEcho(prevEcho, prevChannels, prevUserCh);
      return;
    }

    let cancelled = false;
    const userId = user.id;
    // Must use echo.private() for private channels - it triggers auth to /broadcasting/auth.
    // echo.channel() subscribes to PUBLIC channels only (no auth).
    const userChannelName = `App.Models.User.${userId}`;

    /** Dedupe: same reservation can arrive from user channel + restaurant channel + multiple event names */
    const recentReservationKeys = new Map();
    const DEDUPE_MS = 5000;
    const getReservationKey = (d) => {
      const id = d?.id ?? d?.booking_id ?? d?.reservation_id ?? d?.data?.id ?? d?.data?.reservation_id ?? d?.reservation?.id;
      if (id != null && id !== "") return `reservation-${id}`;
      // Fallback: use restaurant+date+time (omit customer to dedupe across payload shapes)
      return `reservation-${d?.restaurant_id ?? ""}-${d?.reservation_date ?? ""}-${d?.reservation_time ?? ""}`;
    };
    const dispatchReservation = (payload) => {
      let raw = payload?.data ?? payload ?? {};
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw) || {};
        } catch (_) {
          raw = {};
        }
      }
      const detail = raw?.reservation ?? raw;
      const flat = typeof detail === "object" && detail !== null ? { ...detail } : {};
      const key = getReservationKey(flat);
      const now = Date.now();
      if (recentReservationKeys.has(key) && now - recentReservationKeys.get(key) < DEDUPE_MS) {
        if (DEBUG) console.log("[Notifications] Skipping duplicate reservation:", key);
        return;
      }
      recentReservationKeys.set(key, now);
      setTimeout(() => recentReservationKeys.delete(key), DEDUPE_MS);
      if (DEBUG) console.log("[Notifications] New reservation received:", payload);
      window.dispatchEvent(new CustomEvent(EVENTS.NEW_RESERVATION, { detail: flat }));
    };

    const dispatchReservationUpdated = (payload) => {
      if (DEBUG) console.log("[Notifications] Reservation updated:", payload);
      const detail = payload?.data ?? payload ?? {};
      window.dispatchEvent(new CustomEvent(EVENTS.RESERVATION_UPDATED, { detail }));
    };

    /** Dedupe: same order can arrive from user + restaurant channels */
    const recentOrderKeys = new Map();
    const getOrderKey = (d) => {
      const id = d?.id ?? d?.order_id ?? d?.table_order_id ?? d?.data?.id ?? d?.data?.order_id ?? d?.order?.id;
      if (id != null && id !== "") return `order-${id}`;
      return `order-${d?.restaurant_id ?? ""}-${Date.now()}`;
    };
    const dispatchOrder = (payload, channelRestaurantId) => {
      if (DEBUG) console.log("[Notifications] New order received:", payload);
      // Laravel broadcasts new.order with { order: {...} }; also support { data: { order } }
      let order = payload?.order ?? payload?.table_order ?? payload?.data?.order ?? payload?.data ?? payload ?? {};
      if (order && typeof order === "object" && order.order) order = order.order;
      const detail = typeof order === "object" && order !== null ? order : {};
      if ((!detail.restaurant_id && detail.restaurant_id !== 0) && channelRestaurantId) {
        detail.restaurant_id = channelRestaurantId;
      }
      const key = getOrderKey(detail);
      const now = Date.now();
      if (recentOrderKeys.has(key) && now - recentOrderKeys.get(key) < DEDUPE_MS) {
        if (DEBUG) console.log("[Notifications] Skipping duplicate order:", key);
        return;
      }
      recentOrderKeys.set(key, now);
      setTimeout(() => recentOrderKeys.delete(key), DEDUPE_MS);
      window.dispatchEvent(new CustomEvent(EVENTS.NEW_ORDER, { detail }));
    };

    const handleNotification = (n) => {
      const type = (n?.type ?? "").toString();
      if (type === "NewReservation" || type?.toLowerCase().includes("reservation")) {
        dispatchReservation(n);
      } else if (type?.toLowerCase().includes("order")) {
        dispatchOrder(n);
      }
    };

    const handleLaravelNotification = (e) => {
      const notif = e?.notification ?? e?.data ?? e;
      const type = (notif?.type ?? notif?.data?.type ?? "").toString();
      if (type === "NewReservation" || type?.toLowerCase().includes("reservation")) {
        dispatchReservation(notif);
      } else if (type?.toLowerCase().includes("order")) {
        dispatchOrder(notif);
      }
    };

    const fetchRestaurants = () => {
      if (user.restaurants && Array.isArray(user.restaurants) && user.restaurants.length > 0) {
        return Promise.resolve(user.restaurants.map((r) => (typeof r === "object" ? r.id : r)).filter(Boolean));
      }
      return getMyRestaurants(token).then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.restaurants ?? [];
        return list.map((r) => (typeof r === "object" ? r.id : r)).filter(Boolean);
      }).catch((e) => {
        if (DEBUG) console.error("[Notifications] Failed to fetch restaurants for user channels", e);
        return [];
      });
    };

    Promise.all([
      createEcho({ userId, token }),
      fetchRestaurants(),
    ]).then(([echo, restaurantIds]) => {
      if (cancelled || !echo) {
        if (DEBUG && !echo) console.warn("[Notifications] Echo not created, check Pusher config");
        return;
      }

      echoRef.current = echo;

      // User channel (NewReservationNotification, OrderCreated) - must use .private() for auth
      const userChannel = echo.private(userChannelName);
      userChannelRef.current = userChannel;

      // Listen to one form of each event (Laravel Echo may deliver same event to both X and .X)
      // Orders: support OrderCreated, NewOrderNotification, order.created (broadcastAs), .OrderCreated
      userChannel
        .listen("NewReservationNotification", dispatchReservation)
        .listen("NewReservation", dispatchReservation)
        .listen("ReservationCreated", dispatchReservation)
        .listen("OrderCreated", dispatchOrder)
        .listen("NewOrderNotification", dispatchOrder)
        .listen("order.created", dispatchOrder)
        .listen(".OrderCreated", dispatchOrder)
        .listen("Illuminate.Notifications.Events.BroadcastNotificationCreated", handleLaravelNotification)
        .listen("Illuminate\\Notifications\\Events\\BroadcastNotificationCreated", handleLaravelNotification)
        .notification(handleNotification);

      userChannel.on("pusher:subscription_succeeded", () => {
        if (DEBUG) console.log("[Notifications] Subscribed to user channel: private-" + userChannelName);
      });
      userChannel.on("pusher:subscription_error", (err) => {
        if (DEBUG) console.error("[Notifications] User channel subscription failed:", err);
      });

      // Restaurant channels (ReservationCreated, ReservationUpdated, OrderCreated) - must use .private() for auth
      // Inject restaurant_id from channel into payload so modal always has it for accept/reject
      (restaurantIds || []).forEach((restaurantId) => {
        const chName = `restaurant.${restaurantId}`;
        const ch = echo.private(chName);
        restaurantChannelsRef.current.push({ name: chName, channel: ch });

        const injectRestaurantId = (fn) => (payload) => {
          const detail = payload?.order ?? payload?.reservation ?? payload?.data ?? payload ?? {};
          const normalized = typeof detail === "object" && detail !== null ? { ...detail, restaurant_id: detail.restaurant_id ?? restaurantId } : { restaurant_id: restaurantId, ...payload };
          fn(normalized);
        };
        const injectRestaurantIdOrder = (payload) => {
          let order = payload?.order ?? payload?.table_order ?? payload?.data?.order ?? payload?.data ?? payload ?? {};
          if (order && typeof order === "object" && order.order) order = order.order;
          const detail = typeof order === "object" && order !== null ? { ...order, restaurant_id: order.restaurant_id ?? restaurantId } : { restaurant_id: restaurantId };
          dispatchOrder(detail);
        };
        const injectRestaurantIdReservation = (payload) => {
          const res = payload?.reservation ?? payload?.data ?? payload ?? {};
          const detail = typeof res === "object" && res !== null ? { ...res, restaurant_id: res.restaurant_id ?? restaurantId } : { restaurant_id: restaurantId };
          dispatchReservation(detail);
        };

        // Orders: API docs say event name is ".new.order" on private-restaurant.{id} (OrderPlacedEvent)
        const orderHandler = (payload) => {
          if (DEBUG) console.log("[Notifications] Order event received on restaurant channel", restaurantId, payload);
          injectRestaurantIdOrder(payload);
        };
        // Reservations: API docs say ".ReservationCreated" on restaurant channel; also new.reservation
        ch.listen("new.reservation", injectRestaurantIdReservation)
          .listen(".new.reservation", injectRestaurantIdReservation)
          .listen("ReservationCreated", injectRestaurantIdReservation)
          .listen(".ReservationCreated", injectRestaurantIdReservation)
          .listen("ReservationUpdated", (e) => {
            const res = e?.reservation ?? e?.data ?? e ?? {};
            const detail = typeof res === "object" && res !== null ? { ...res, restaurant_id: res.restaurant_id ?? restaurantId } : { restaurant_id: restaurantId };
            dispatchReservationUpdated(detail);
          })
          .listen(".new.order", orderHandler)
          .listen("new.order", orderHandler)
          .listen("OrderCreated", orderHandler)
          .listen(".OrderCreated", orderHandler)
          .listen("NewOrderNotification", orderHandler)
          .listen("order.created", orderHandler)
          .listen("TableOrderCreated", orderHandler)
          .listen("FoodOrderCreated", orderHandler)
          .listen("order.updated", injectRestaurantIdOrder)
          .listen("reservation.confirmed", (e) => {
            const res = e?.reservation ?? e?.data ?? e ?? {};
            const detail = typeof res === "object" && res !== null ? { ...res, restaurant_id: res.restaurant_id ?? restaurantId } : { restaurant_id: restaurantId };
            dispatchReservationUpdated(detail);
          });

        ch.on("pusher:subscription_succeeded", () => {
          if (DEBUG) console.log("[Notifications] Subscribed to restaurant channel: private-" + chName);
        });
        ch.on("pusher:subscription_error", (err) => {
          if (DEBUG) console.warn("[Notifications] Restaurant channel subscription failed:", chName, err);
        });
      });

      if (DEBUG) {
        console.log("[Notifications] Subscribed to user +", restaurantIds?.length ?? 0, "restaurant channel(s). Waiting for events...");
      }
    });

    return () => {
      cancelled = true;
      // Capture refs immediately so we only clean up THIS effect's instance.
      // Fast Refresh re-runs the effect and overwrites echoRef with a new Echo;
      // without capturing, we'd disconnect the wrong (new) instance.
      const echoInstance = echoRef.current;
      const channels = [...restaurantChannelsRef.current];
      const userCh = userChannelRef.current;
      echoRef.current = null;
      userChannelRef.current = null;
      restaurantChannelsRef.current = [];

      if (echoInstance) {
        setTimeout(() => cleanupEcho(echoInstance, channels, userCh), 0);
      }
    };
  }, [authLoading, isAuthenticated, token, user?.id, user?.role, cleanupEcho]);

  return (
    <RealTimeNotificationContext.Provider value={{}}>
      {children}
    </RealTimeNotificationContext.Provider>
  );
}

export function useRealTimeNotifications() {
  return useContext(RealTimeNotificationContext) ?? {};
}
