"use client";

import { useEffect, useState, useCallback } from "react";
import { EVENTS } from "@/context/RealTimeNotificationContext";
import { useAuth } from "@/context/AuthContext";
import { updateOrderStatus, updateReservationStatus } from "@/lib/api";
import { NotificationStack } from "@/components/NotificationStack";

/** Extract restaurant ID from /owner/dashboard/[id] path when on owner dashboard */
function getRestaurantIdFromPath() {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/\/owner\/dashboard\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Centralized live notification stack: food orders and table reservations.
 * All events appear in one stack, bottom-right (desktop) / bottom with margin (mobile).
 * Newest on top, stacked like social site popups.
 */
export function LiveNotificationToast() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const getReservationKey = (d) => {
      const id = d?.id ?? d?.booking_id ?? d?.reservation_id ?? d?.data?.id ?? d?.data?.booking_id ?? d?.data?.reservation_id ?? d?.reservation?.id;
      if (id != null && id !== "") return `reservation-${id}`;
      return `reservation-${d?.restaurant_id ?? ""}-${d?.reservation_date ?? ""}-${d?.reservation_time ?? ""}-${d?.customer_name ?? ""}`;
    };
    const getOrderKey = (d) => {
      const id = d?.id ?? d?.order_id ?? d?.table_order_id ?? d?.data?.id ?? d?.data?.order_id ?? d?.order?.id;
      if (id != null && id !== "") return `order-${id}`;
      return `order-${d?.restaurant_id ?? ""}-${Date.now()}`;
    };

    const handleReservation = (e) => {
      const detail = e.detail ?? {};
      const key = getReservationKey(detail);
      setToasts((prev) => {
        if (prev.some((t) => t.type === "reservation" && t.dedupeKey === key)) return prev;
        const id = `res-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const restaurantName = detail.restaurant?.name ?? "Restaurant";
        const customerName = detail.customer_name ?? detail.user?.name ?? "A customer";
        return [
          ...prev,
          { id, dedupeKey: key, type: "reservation", title: "New Reservation", message: `${customerName} made a reservation at ${restaurantName}`, detail },
        ];
      });
    };

    const handleOrder = (e) => {
      const detail = e.detail ?? {};
      const key = getOrderKey(detail);
      setToasts((prev) => {
        if (prev.some((t) => t.type === "order" && t.dedupeKey === key)) return prev;
        const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const restaurantName = detail.restaurant_name ?? detail.restaurant?.name ?? "Restaurant";
        return [
          ...prev,
          { id, dedupeKey: key, type: "order", title: "New Order", message: `New order received for ${restaurantName}`, detail },
        ];
      });
    };

    const handleReservationUpdated = (e) => {
      const detail = e.detail ?? {};
      const restaurantName = detail.restaurant?.name ?? "Restaurant";
      const status = detail.status ?? "updated";
      const id = `res-upd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [
        ...prev,
        {
          id,
          type: "reservation-updated",
          title: "Reservation updated",
          message: `Reservation at ${restaurantName} is now ${status}`,
          detail,
        },
      ]);
      setTimeout(() => removeToast(id), 8000);
    };

    window.addEventListener(EVENTS.NEW_RESERVATION, handleReservation);
    window.addEventListener(EVENTS.NEW_ORDER, handleOrder);
    window.addEventListener(EVENTS.RESERVATION_UPDATED, handleReservationUpdated);

    return () => {
      window.removeEventListener(EVENTS.NEW_RESERVATION, handleReservation);
      window.removeEventListener(EVENTS.NEW_ORDER, handleOrder);
      window.removeEventListener(EVENTS.RESERVATION_UPDATED, handleReservationUpdated);
    };
  }, [removeToast]);

  if (toasts.length === 0) return null;

  // Newest first (top of stack)
  const ordered = [...toasts].reverse();

  return (
    <NotificationStack>
      {ordered.map((t) =>
        t.type === "reservation-updated" ? (
          <LiveToastItem
            key={t.id}
            {...t}
            onDismiss={() => removeToast(t.id)}
          />
        ) : (
          <LiveCardItem
            key={t.id}
            {...t}
            onDismiss={() => removeToast(t.id)}
          />
        )
      )}
    </NotificationStack>
  );
}

function LiveCardItem({ id, type, title, message, detail, onDismiss }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const isReservation = type === "reservation";
  const isActionable = !success;

  const handleAction = async (status) => {
    setLoading(true);
    setError(null);
    try {
      if (process.env.NODE_ENV === "development" && detail) {
        console.log("[LiveNotification] Accept/Reject payload:", { type, detail });
      }
      const inner = detail?.order ?? detail?.reservation ?? detail?.table_order ?? detail?.data ?? detail;
      const entity = inner?.order ?? inner?.reservation ?? inner?.table_order ?? inner;
      let restaurantId = entity?.restaurant_id ?? inner?.restaurant_id ?? detail?.restaurant_id ?? entity?.restaurant?.id ?? inner?.restaurant?.id ?? detail?.restaurant?.id ?? detail?.data?.restaurant_id;
      let itemId = entity?.id ?? inner?.id ?? detail?.id ?? entity?.order_id ?? inner?.order_id ?? detail?.order_id ?? entity?.reservation_id ?? inner?.reservation_id ?? detail?.reservation_id ?? entity?.table_order_id ?? inner?.table_order_id ?? detail?.table_order_id ?? entity?.booking_id ?? inner?.booking_id ?? detail?.booking_id ?? detail?.data?.id ?? detail?.data?.order_id ?? detail?.data?.reservation_id;

      if (!restaurantId) {
        restaurantId = getRestaurantIdFromPath() ?? process.env.NEXT_PUBLIC_RESTAURANT_ID;
      }

      if (!restaurantId || itemId == null || itemId === "") {
        const missing = [];
        if (!restaurantId) missing.push("restaurant_id");
        if (itemId == null || itemId === "") missing.push("order/reservation id");
        throw new Error(`Missing ${missing.join(" and ")} to perform action. Received: ${JSON.stringify({ restaurantId, itemId, hasDetail: !!detail })}`);
      }

      restaurantId = String(restaurantId);
      itemId = String(itemId);

      if (type === "reservation") {
        await updateReservationStatus(token, restaurantId, itemId, status);
      } else if (type === "order") {
        await updateOrderStatus(token, restaurantId, itemId, status === "confirmed" ? "confirmed" : "rejected");
      }

      setSuccess(true);
      if (type === "order") {
        window.dispatchEvent(new CustomEvent(EVENTS.ORDER_UPDATED, { detail }));
      } else {
        window.dispatchEvent(new CustomEvent(EVENTS.RESERVATION_UPDATED, { detail }));
      }
      setTimeout(onDismiss, 2000);
    } catch (err) {
      setError(err?.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="alert"
      className="relative w-full overflow-hidden rounded-2xl bg-wood-900 p-4 text-left shadow-xl border border-wood-300 dark:border-wood-600 text-wood-100"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          {isReservation ? (
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-wood-100">{title}</h3>
          <p className="text-sm text-wood-200 truncate">{message}</p>
        </div>
      </div>

      {detail && (
        <div className="mt-3 rounded-xl bg-wood-800 p-3 dark:bg-wood-800/50 text-sm text-wood-100 max-h-32 overflow-y-auto">
          {type === "reservation" && (
            <ul className="space-y-1">
              <li><strong className="text-wood-100">Date:</strong> {detail.reservation_date} at {detail.reservation_time}</li>
              <li><strong className="text-wood-100">Party:</strong> {detail.party_size != null ? `${detail.party_size} guest${Number(detail.party_size) === 1 ? "" : "s"}` : "—"}</li>
              <li><strong className="text-wood-100">Customer:</strong> {detail.customer_name || detail.user?.name}</li>
              {detail.special_requests && <li className="truncate"><strong>Notes:</strong> {detail.special_requests}</li>}
            </ul>
          )}
          {type === "order" && (
            <ul className="space-y-1">
              <li><strong className="text-wood-100">Total:</strong> ${detail.total_amount ?? "—"}</li>
              <li><strong className="text-wood-100">Type:</strong> {detail.order_type ?? (detail.delivery_address?.toLowerCase?.().includes("pickup") ? "Pickup" : "Delivery") ?? "—"}</li>
              <li><strong className="text-wood-100">Customer:</strong> {detail.customer_name || detail.user?.name || "—"}</li>
              {detail.items?.length > 0 && (
                <li><strong className="text-wood-100">Items:</strong> {detail.items.map((i) => i.item_name ?? i.name).filter(Boolean).join(", ")}</li>
              )}
              {(detail.delivery_instructions || detail.notes) && <li className="truncate"><strong>Notes:</strong> {detail.delivery_instructions || detail.notes}</li>}
            </ul>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-500 font-medium">{error}</p>}
      {success && <p className="mt-2 text-sm text-emerald-500 font-medium">Status updated!</p>}

      {isActionable && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleAction("confirmed")}
            disabled={loading}
            className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : "Accept"}
          </button>
          <button
            onClick={() => handleAction("rejected")}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : "Reject"}
          </button>
        </div>
      )}

      {(!isActionable || success) && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl bg-wood-700 px-3 py-2 text-sm font-medium text-wood-100 hover:bg-wood-600 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function LiveToastItem({ id, type, title, message, onDismiss }) {
  return (
    <div
      role="alert"
      className="flex max-w-sm gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-xl dark:border-emerald-800 dark:bg-zinc-900"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
        <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
          {message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 text-xs font-medium text-emerald-600 underline hover:no-underline dark:text-emerald-400"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
