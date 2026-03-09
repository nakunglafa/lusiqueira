"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getOrders } from "@/lib/api";
import { OrderNotificationModal } from "@/components/OrderNotificationModal";

function formatStatus(s) {
  if (!s || typeof s !== "string") return s;
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPrice(v) {
  if (v == null || v === "") return "$0.00";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? "$0.00" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const PENDING_STATUSES = ["pending", "pending_confirmation", "new"];
function hasPendingOrders(orders) {
  return Array.isArray(orders) && orders.some((o) => {
    const s = (o?.status || "").toLowerCase();
    return PENDING_STATUSES.some((p) => s.includes(p) || p.includes(s));
  });
}

// Active = in progress; History = delivered, cancelled, rejected
const ACTIVE_STATUSES = ["pending", "pending_confirmation", "new", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"];

function isActiveOrder(order) {
  const s = (order?.status ?? order?.order_status ?? "").toLowerCase().replace(/\s+/g, "_");
  return ACTIVE_STATUSES.some((p) => s.includes(p) || p.includes(s));
}

function normalizeStatus(s) {
  return (s ?? "").toLowerCase().replace(/\s+/g, "_");
}

// Status filter shortcuts
const FILTER_SHORTCUTS = [
  { value: "", label: "All" },
  { value: "pending_confirmation", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function getStatusBadgeClass(status) {
  const s = (status ?? "").toLowerCase();
  if (s.includes("pending") || s.includes("new")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (s.includes("confirmed") || s.includes("preparing")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (s.includes("ready") || s.includes("delivery")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (s.includes("delivered")) return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";
  if (s.includes("cancelled") || s.includes("rejected")) return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300";
}

export default function OrdersPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [mainTab, setMainTab] = useState("active"); // "active" | "history"
  const [statusFilter, setStatusFilter] = useState("");
  const pollIntervalRef = useRef(null);

  const load = useCallback((showLoading = true) => {
    if (!token) return;
    if (showLoading) {
      setError("");
      setLoading(true);
    }
    getOrders(token)
      .then((data) => {
        const arr = Array.isArray(data) ? data : data?.data ?? data?.orders ?? [];
        setOrders(Array.isArray(arr) ? arr : []);
        if (!hasPendingOrders(arr)) setNotificationDismissed(false);
      })
      .catch((err) => {
        if (showLoading) {
          setError(err?.message || err?.data?.message || "Failed to load orders");
          setOrders([]);
        }
      })
      .finally(() => { if (showLoading) setLoading(false); });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !isAuthenticated) return;
    pollIntervalRef.current = setInterval(() => {
      getOrders(token)
        .then((data) => {
          const arr = Array.isArray(data) ? data : data?.data ?? data?.orders ?? [];
          setOrders(Array.isArray(arr) ? arr : []);
          if (!hasPendingOrders(arr)) setNotificationDismissed(false);
        })
        .catch(() => {});
    }, 10000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [token, isAuthenticated]);

  // Filter orders: Active vs History, then by status
  const filteredOrders = orders.filter((o) => {
    const status = normalizeStatus(o?.status ?? o?.order_status);
    const active = isActiveOrder(o);
    if (mainTab === "active" && !active) return false;
    if (mainTab === "history" && active) return false;
    if (statusFilter && status !== statusFilter) return false;
    return true;
  });

  const activeCount = orders.filter(isActiveOrder).length;
  const historyCount = orders.filter((o) => !isActiveOrder(o)).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-wood-100">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-12">
          <p className="text-center text-wood-600">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-wood-100">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-12">
          <p className="text-center text-wood-600">
            Please <Link href="/login" className="text-accent hover:underline">log in</Link> to view your orders.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <h1 className="mb-6 text-2xl font-bold text-wood-900">My Orders</h1>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300">{error}</p>
            <button type="button" onClick={() => load(true)} className="mt-2 text-sm font-medium text-red-300 hover:underline">
              Try again
            </button>
          </div>
        )}

        {loading && <p className="py-8 text-center text-wood-600">Loading orders…</p>}

        {!loading && !error && orders.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center border border-white/10">
            <p className="text-wood-600">No orders yet.</p>
            <Link
              href="/menu"
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-medium text-wood-950 hover:bg-accent-hover transition-colors"
            >
              Browse menu
            </Link>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-6">
            {/* Active / History tabs */}
            <div className="flex gap-2 rounded-xl bg-white/10 p-1.5 border border-white/10 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setMainTab("active")}
                className={`touch-manipulation min-h-[48px] flex-1 rounded-lg px-4 py-3 text-base font-medium transition-colors active:scale-[0.98] ${
                  mainTab === "active"
                    ? "bg-white/20 text-wood-900 shadow"
                    : "text-wood-600 hover:text-wood-900"
                }`}
              >
                Active
                {activeCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-emerald-500/30 px-1.5 py-0.5 text-xs font-medium text-wood-900">
                    {activeCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMainTab("history")}
                className={`touch-manipulation min-h-[48px] flex-1 rounded-lg px-4 py-3 text-base font-medium transition-colors active:scale-[0.98] ${
                  mainTab === "history"
                    ? "bg-white/20 text-wood-900 shadow"
                    : "text-wood-600 hover:text-wood-900"
                }`}
              >
                History
                {historyCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-wood-500/30 px-1.5 py-0.5 text-xs text-wood-900">
                    {historyCount}
                  </span>
                )}
              </button>
            </div>

            {/* Status filter shortcuts */}
            <div className="flex flex-wrap gap-2">
              {FILTER_SHORTCUTS.map((s) => (
                <button
                  key={s.value || "all"}
                  type="button"
                  onClick={() => setStatusFilter(s.value)}
                  className={`touch-manipulation min-h-[40px] rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    statusFilter === s.value
                      ? "bg-accent text-wood-950"
                      : "bg-white/10 text-wood-700 hover:bg-white/15 border border-white/10"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center border border-white/10">
                <p className="text-wood-600">
                  {mainTab === "active" ? "No active orders." : "No orders in history."}
                </p>
                <p className="mt-1 text-sm text-wood-500">Try changing the filter or tab.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {filteredOrders.map((order) => (
                  <li key={order.id} className="glass rounded-2xl p-5 border border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="text-lg font-bold text-wood-900">Order #{order.id}</span>
                        {order.restaurant_name && (
                          <p className="mt-0.5 text-sm text-wood-600">{order.restaurant_name}</p>
                        )}
                        {order.created_at && (
                          <p className="mt-1 text-sm text-wood-500">{new Date(order.created_at).toLocaleString()}</p>
                        )}
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(
                          order.status ?? order.order_status
                        )}`}
                      >
                        {formatStatus(order.status ?? order.order_status)}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                      <span className="font-semibold text-wood-900">{formatPrice(order.total ?? order.total_amount)}</span>
                      {order.items && order.items.length > 0 && (
                        <span className="text-sm text-wood-500">
                          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <OrderNotificationModal
          orders={orders}
          visible={hasPendingOrders(orders) && !notificationDismissed}
          onDismiss={() => setNotificationDismissed(true)}
        />
      </main>
    </div>
  );
}
