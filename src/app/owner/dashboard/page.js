"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getRestaurantOrders,
  getOwnerRestaurantReservations,
} from "@/lib/api";
import { toArray } from "@/lib/owner-utils";
import { useOwnerRefresh } from "@/context/OwnerRefreshContext";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "9";

function getOrderTotal(order) {
  const o = order?.order ?? order;
  const total = o?.total ?? o?.total_amount ?? o?.order_total ?? o?.amount ?? 0;
  return typeof total === "number" ? total : parseFloat(total) || 0;
}

function getReservationDate(r) {
  const res = r?.reservation ?? r;
  const iso = res?.reservation_datetime ?? res?.datetime ?? res?.reservation_date ?? res?.date;
  const time = res?.reservation_time ?? res?.time ?? "";
  if (iso && typeof iso === "string") {
    const d = new Date(iso.includes("T") ? iso : `${iso}T${time || "00:00"}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const dateStr = (res?.reservation_date ?? res?.date ?? "").toString();
  const timeStr = (res?.reservation_time ?? res?.time ?? "").toString();
  if (dateStr) {
    const d = new Date(timeStr ? `${dateStr}T${timeStr}` : dateStr);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const { registerRefresh } = useOwnerRefresh();
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentReservations, setRecentReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboardData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    Promise.all([
      getRestaurantOrders(token, RESTAURANT_ID),
      getOwnerRestaurantReservations(token, RESTAURANT_ID),
    ])
      .then(([ordersRes, reservationsRes]) => {
        const orders = toArray(ordersRes);
        const reservations = toArray(reservationsRes);
        const sortedOrders = [...orders].sort((a, b) => {
          const da = new Date(a?.created_at ?? a?.order?.created_at ?? 0).getTime();
          const db = new Date(b?.created_at ?? b?.order?.created_at ?? 0).getTime();
          return db - da;
        });
        const sortedReservations = [...reservations].sort((a, b) => {
          const da = (getReservationDate(a) || new Date(0)).getTime();
          const db = (getReservationDate(b) || new Date(0)).getTime();
          return db - da;
        });
        setRecentOrders(sortedOrders.slice(0, 5));
        setRecentReservations(sortedReservations.slice(0, 5));
      })
      .catch((err) => {
        setError(err?.data?.message || err?.message || "Failed to load dashboard");
        setRecentOrders([]);
        setRecentReservations([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/owner/dashboard");
      return;
    }
    if (token) loadDashboardData();
  }, [token, authLoading, isAuthenticated, router, loadDashboardData]);

  useEffect(() => {
    return registerRefresh(loadDashboardData);
  }, [registerRefresh, loadDashboardData]);

  if (authLoading || !isAuthenticated) return null;

  const totalRevenue = recentOrders.reduce((sum, o) => sum + getOrderTotal(o), 0);
  const salesByDay = recentOrders.reduce((acc, order) => {
    const o = order?.order ?? order;
    const date = o?.created_at ?? order?.created_at;
    const d = date ? new Date(date).toLocaleDateString() : "Unknown";
    acc[d] = (acc[d] || 0) + getOrderTotal(order);
    return acc;
  }, {});
  const maxDayRevenue = Math.max(...Object.values(salesByDay), 1);

  const iconClass = "text-owner-success";
  const iconSize = 20;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-owner-charcoal">
          Dashboard
        </h1>
        <Link
          href={`/owner/dashboard/${RESTAURANT_ID}`}
          className="inline-flex items-center gap-2 rounded-lg bg-owner-action px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-90">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Manage restaurant
        </Link>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Sales overview */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-owner-charcoal">
          Sales overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="owner-card rounded-xl p-6">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-owner-success/20 ${iconClass}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <p className="text-sm font-medium text-owner-muted">Total revenue (recent)</p>
            <p className="mt-1 text-2xl font-bold text-owner-charcoal">
              €{totalRevenue.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-owner-muted">From last 5 orders</p>
          </div>
          <div className="owner-card rounded-xl p-6">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-owner-success/20 ${iconClass}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <p className="text-sm font-medium text-owner-muted">Recent orders</p>
            <p className="mt-1 text-2xl font-bold text-owner-charcoal">
              {recentOrders.length}
            </p>
            <p className="mt-1 text-xs text-owner-muted">Latest 5</p>
          </div>
          <div className="owner-card rounded-xl p-6">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-owner-success/20 ${iconClass}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-sm font-medium text-owner-muted">Recent bookings</p>
            <p className="mt-1 text-2xl font-bold text-owner-charcoal">
              {recentReservations.length}
            </p>
            <p className="mt-1 text-xs text-owner-muted">Latest 5</p>
          </div>
        </div>

        {/* Sales by day */}
        {Object.keys(salesByDay).length > 0 && (
          <div className="owner-card mt-6 rounded-xl p-6">
            <h3 className="mb-4 text-sm font-semibold text-owner-charcoal">Sales by day</h3>
            <div className="space-y-3">
              {Object.entries(salesByDay).map(([day, revenue]) => (
                <div key={day} className="flex items-center gap-4">
                  <span className="w-32 shrink-0 text-sm text-owner-muted">{day}</span>
                  <div className="min-w-0 flex-1 h-8 overflow-hidden rounded bg-owner-paper">
                    <div
                      className="h-full min-w-[4px] rounded bg-owner-success"
                      style={{ width: `${(revenue / maxDayRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-medium text-owner-charcoal">
                    €{revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent orders */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-owner-charcoal">
              Recent orders
            </h2>
            <Link
              href={`/owner/dashboard/${RESTAURANT_ID}`}
              className="text-sm font-medium text-owner-action hover:opacity-80"
            >
              View all →
            </Link>
          </div>
          <div className="owner-card rounded-xl">
            {loading ? (
              <div className="p-8 text-center text-owner-muted">Loading...</div>
            ) : recentOrders.length === 0 ? (
              <div className="p-8 text-center text-owner-muted">No recent orders</div>
            ) : (
              <ul className="divide-y divide-owner-border">
                {recentOrders.map((order) => {
                  const o = order?.order ?? order;
                  const total = getOrderTotal(order);
                  const date = o?.created_at ?? order?.created_at;
                  const status = o?.status ?? order?.status ?? "—";
                  return (
                    <li key={o?.id ?? order?.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium text-owner-charcoal">
                          Order #{o?.id ?? order?.id}
                        </p>
                        <p className="text-sm text-owner-muted">
                          {date ? new Date(date).toLocaleString() : "—"} · {String(status).replace(/_/g, " ")}
                        </p>
                      </div>
                      <p className="font-semibold text-owner-charcoal">
                        €{total.toFixed(2)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Recent bookings */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-owner-charcoal">
              Recent bookings
            </h2>
            <Link
              href={`/owner/dashboard/${RESTAURANT_ID}`}
              className="text-sm font-medium text-owner-action hover:opacity-80"
            >
              View all →
            </Link>
          </div>
          <div className="owner-card rounded-xl">
            {loading ? (
              <div className="p-8 text-center text-owner-muted">Loading...</div>
            ) : recentReservations.length === 0 ? (
              <div className="p-8 text-center text-owner-muted">No recent bookings</div>
            ) : (
              <ul className="divide-y divide-owner-border">
                {recentReservations.map((res) => {
                  const r = res?.reservation ?? res;
                  const name = r?.customer_name ?? r?.user?.name ?? "Guest";
                  const date = getReservationDate(res);
                  const status = r?.status ?? "—";
                  return (
                    <li key={r?.id ?? res?.id} className="px-4 py-3">
                      <p className="font-medium text-owner-charcoal">{name}</p>
                      <p className="text-sm text-owner-muted">
                        {date ? date.toLocaleString() : "—"} · {String(status).replace(/_/g, " ")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
