"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getRestaurantOrders, updateOrderStatus } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { toArray } from "@/lib/owner-utils";

// API-supported status values (confirmed = accept, rejected = reject)
const STATUS_OPTIONS = [
  { value: "pending_confirmation", label: "Pending" },
  { value: "confirmed", label: "Confirmed (accept)" },
  { value: "rejected", label: "Rejected" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

// Popular shortcut filters for quick access
const FILTER_SHORTCUTS = [
  { value: "", label: "All" },
  { value: "pending_confirmation", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
];

function getOptionsForOrder(order) {
  const current = order?.status;
  if (!current || STATUS_OPTIONS.some((o) => o.value === current)) {
    return STATUS_OPTIONS;
  }
  return [
    { value: current, label: current.replace(/_/g, " ") },
    ...STATUS_OPTIONS,
  ];
}

function getStatusLabel(value) {
  return STATUS_OPTIONS.find((s) => s.value === value)?.label ?? (value || "").replace(/_/g, " ");
}

function formatPrice(value) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatOrderDateTime(order) {
  const raw = order.placed_at ?? order.created_at ?? order.updated_at;
  if (!raw) return "—";
  return new Date(raw).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function OrdersTab({ restaurantId, orders: ordersProp, onRefresh }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const loadOrders = useCallback((silent = false, cacheBust = false) => {
    if (!token || !restaurantId) return;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    getRestaurantOrders(token, restaurantId, statusFilter || undefined, cacheBust)
      .then((res) => {
        const arr = toArray(res);
        setOrders(arr.map((o) => ({ ...o, status: o.status ?? o.order_status ?? "" })));
      })
      .catch((err) => {
        if (!silent) {
          setError(err?.data?.message || err?.message || "Failed to load orders");
          setOrders([]);
        }
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [token, restaurantId, statusFilter]);

  // Use parent's orders when provided (enables real-time refresh from OwnerRefreshContext)
  const rawOrders = ordersProp != null && Array.isArray(ordersProp)
    ? ordersProp.map((o) => ({ ...o, status: o.status ?? o.order_status ?? "" }))
    : orders;
  const displayOrders = statusFilter
    ? rawOrders.filter((o) => (o.status ?? o.order_status ?? "") === statusFilter)
    : rawOrders;

  useEffect(() => {
    if (ordersProp != null && Array.isArray(ordersProp)) {
      setLoading(false);
      return;
    }
    loadOrders(false);
  }, [loadOrders, ordersProp]);

  async function handleStatusChange(orderId, newStatus) {
    if (!token || !restaurantId) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    try {
      await updateOrderStatus(token, restaurantId, orderId, newStatus);
      if (onRefresh) onRefresh();
      else loadOrders(true, true);
    } catch (err) {
      const msg = err?.data?.message || err?.message || "Failed to update status";
      setToastMessage(msg);
      if (onRefresh) onRefresh();
      else loadOrders(true, true);
    }
  }

  if (loading) return <p className="py-8 text-owner-muted">Loading orders...</p>;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => loadOrders(false)}
          className="touch-manipulation mt-2 min-h-[48px] rounded-xl bg-red-100 px-4 py-3 text-base md:text-sm font-medium text-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative max-w-full min-w-0">
      <Toast
        message={toastMessage}
        type="error"
        onClose={() => setToastMessage(null)}
      />
      {/* Shortcut filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTER_SHORTCUTS.map((s) => (
          <button
            key={s.value || "all"}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            className={`touch-manipulation min-h-[40px] rounded-full px-4 py-2 text-sm md:text-xs font-medium transition-colors ${
              statusFilter === s.value
                ? "bg-owner-action text-white"
                : "bg-owner-paper text-owner-charcoal hover:bg-owner-border border border-owner-border"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {displayOrders.length === 0 ? (
        <p className="py-8 text-owner-muted">No orders found.</p>
      ) : (
        <ul className="space-y-4">
          {displayOrders.map((order) => {
            const customerName = order.customer_name ?? order.user?.name ?? "Guest";
            const customerEmail = order.customer_email ?? order.user?.email ?? "";
            const customerPhone = order.customer_phone ?? order.user?.phone ?? "";
            const orderType = (order.order_type || "").toLowerCase();
            const isDelivery = orderType === "delivery";
            const itemsList = Array.isArray(order.items) ? order.items : [];
            const notes = order.delivery_instructions ?? order.notes ?? "";
            return (
              <li
                key={order.id}
                className="owner-card rounded-xl border border-owner-border overflow-hidden"
              >
                {/* Header: Order #, date, status dropdown */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-owner-border bg-owner-paper/50 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-base md:text-sm font-semibold text-owner-charcoal">Order #{order.id}</span>
                    <span className="text-sm md:text-xs text-owner-muted">{formatOrderDateTime(order)}</span>
                  </div>
                  <select
                    value={order.status ?? order.order_status ?? ""}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="touch-manipulation min-h-[44px] min-w-[140px] rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-sm font-medium text-owner-charcoal"
                  >
                    {getOptionsForOrder(order).map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 space-y-4">
                  {/* Contact: name, phone (call), email (mail) */}
                  <div className="rounded-lg bg-owner-paper/50 border border-owner-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-owner-muted mb-2">Customer / Contact</p>
                    <p className="font-medium text-owner-charcoal">{customerName}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {customerPhone ? (
                        <a
                          href={`tel:${customerPhone.replace(/\s/g, "")}`}
                          className="inline-flex items-center gap-1.5 text-sm text-owner-charcoal hover:text-owner-action font-medium"
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {customerPhone}
                        </a>
                      ) : null}
                      {customerEmail ? (
                        <a
                          href={`mailto:${customerEmail}`}
                          className="inline-flex items-center gap-1.5 text-sm text-owner-charcoal hover:text-owner-action font-medium break-all"
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {customerEmail}
                        </a>
                      ) : null}
                      {!customerPhone && !customerEmail ? (
                        <span className="text-sm text-owner-muted">No phone or email</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Order type & delivery address */}
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-owner-muted">
                      <span className="font-medium text-owner-charcoal">Type:</span>{" "}
                      {orderType === "delivery" ? "Delivery" : orderType === "pickup" ? "Pickup" : orderType || "—"}
                    </p>
                    {isDelivery && (order.delivery_address || order.delivery_address_line_1) && (
                      <p className="text-owner-muted">
                        <span className="font-medium text-owner-charcoal">Address:</span>{" "}
                        {order.delivery_address || order.delivery_address_line_1}
                      </p>
                    )}
                    {notes ? (
                      <p className="text-owner-muted">
                        <span className="font-medium text-owner-charcoal">Notes:</span> {notes}
                      </p>
                    ) : null}
                  </div>

                  {/* Items */}
                  {itemsList.length > 0 && (
                    <div className="rounded-lg border border-owner-border overflow-hidden">
                      <p className="text-xs font-semibold uppercase tracking-wide text-owner-muted px-3 py-2 bg-owner-paper/50 border-b border-owner-border">Items</p>
                      <ul className="divide-y divide-owner-border">
                        {itemsList.map((line, idx) => (
                          <li key={line.id ?? idx} className="flex justify-between gap-2 px-3 py-2 text-sm">
                            <span className="text-owner-charcoal min-w-0">
                              {(line.item_name ?? line.name ?? "Item")} × {Number(line.quantity) || 1}
                            </span>
                            <span className="shrink-0 text-owner-muted">
                              {formatPrice(line.total_price ?? (parseFloat(line.item_price ?? line.price) * (line.quantity || 1)))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex justify-between items-center pt-2 border-t border-owner-border">
                    <span className="font-semibold text-owner-charcoal">Total</span>
                    <span className="font-semibold text-owner-charcoal">{formatPrice(order.total_amount ?? order.total)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
