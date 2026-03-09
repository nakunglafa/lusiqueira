"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getReservations } from "@/lib/api";

/**
 * Get a Date for the reservation (for sorting or display).
 * Handles: full ISO in any field, or reservation_date + reservation_time separately.
 */
function getReservationDate(r) {
  const possibleIso =
    r.reservation_datetime ?? r.datetime ?? r.date_time ?? r.reservation_date ?? r.date ?? r.reservation_time ?? r.time;
  if (possibleIso && typeof possibleIso === "string" && possibleIso.includes("T")) {
    const d = new Date(possibleIso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const dateStr = (r.reservation_date ?? r.date ?? "").toString().trim();
  const timeStr = (r.reservation_time ?? r.time ?? "").toString().trim();
  if (!dateStr) return null;
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const normalizedDate = dateStr.replace(/^(\d{4})-(\d{2})-(\d{2}).*/, "$1-$2-$3");
  if (!normalizedDate || normalizedDate.length < 10) return null;
  let timePart = timeStr ? timeStr.replace(/\.\d+Z?$/i, "").replace(/:$/, "").slice(0, 8) : "00:00:00";
  if (timePart && timePart.length === 5) timePart += ":00";
  const combined = `${normalizedDate}T${timePart || "00:00:00"}`;
  const d = new Date(combined);
  return Number.isNaN(d.getTime()) ? new Date(normalizedDate) : d;
}

/** Format reservation date/time for display in local time, e.g. "Friday, 6 March 2026 at 2:30 pm" */
function formatReservationDateTime(r) {
  const d = getReservationDate(r);
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** e.g. "confirmed" → "Confirmed" */
function formatStatus(status) {
  if (!status || typeof status !== "string") return status;
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

const TAB_UPCOMING = "upcoming";
const TAB_PAST = "past";

export default function ReservationsPage() {
  const router = useRouter();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(TAB_UPCOMING);

  const loadReservations = useCallback(() => {
    if (!token) return;
    setError("");
    setLoading(true);
    getReservations(token)
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.data ?? data?.reservations ?? [];
        setList(Array.isArray(items) ? items : []);
      })
      .catch((err) => {
        const message = err?.message || err?.data?.message || "Failed to load reservations";
        setError(message);
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      router.push("/login");
      return;
    }
    if (!token) return;
    loadReservations();
  }, [token, isAuthenticated, authLoading, router, loadReservations]);

  const now = Date.now();
  const getTime = (r) => (getReservationDate(r) || new Date(0)).getTime();
  const { upcoming, past } = (() => {
    const up = [];
    const pa = [];
    list.forEach((r) => {
      const d = getReservationDate(r);
      if (d && d.getTime() >= now) up.push(r);
      else pa.push(r);
    });
    up.sort((a, b) => getTime(a) - getTime(b));
    pa.sort((a, b) => getTime(b) - getTime(a));
    return { upcoming: up, past: pa };
  })();

  const displayList = activeTab === TAB_UPCOMING ? upcoming : past;

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-wood-900">My reservations</h1>
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300">{error}</p>
            <button type="button" onClick={loadReservations} className="mt-2 text-sm font-medium text-red-300 underline hover:text-red-200">
              Try again
            </button>
          </div>
        )}
        {loading ? (
          <p className="text-wood-600">Loading...</p>
        ) : !error && list.length === 0 ? (
          <p className="text-wood-600">No reservations yet.</p>
        ) : !error ? (
          <>
            <div className="mb-4 flex gap-1 rounded-lg bg-white/10 p-1.5 border border-white/10 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setActiveTab(TAB_UPCOMING)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === TAB_UPCOMING ? "bg-white/20 text-wood-900 shadow" : "text-wood-600 hover:text-wood-900"
                }`}
              >
                Upcoming
                {upcoming.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-wood-500/30 px-1.5 py-0.5 text-xs text-wood-900">
                    {upcoming.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(TAB_PAST)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === TAB_PAST ? "bg-white/20 text-wood-900 shadow" : "text-wood-600 hover:text-wood-900"
                }`}
              >
                Past
                {past.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-wood-500/30 px-1.5 py-0.5 text-xs text-wood-900">
                    {past.length}
                  </span>
                )}
              </button>
            </div>
            {displayList.length === 0 ? (
              <p className="py-6 text-wood-600">
                {activeTab === TAB_UPCOMING ? "No upcoming reservations." : "No past reservations."}
              </p>
            ) : (
              <ul className="space-y-4">
                {displayList.map((r) => (
                  <li key={r.id} className="glass rounded-xl p-5 border border-white/10">
                    <p className="font-semibold text-wood-900">{r.restaurant?.name ?? `Restaurant #${r.restaurant_id}`}</p>
                    <p className="mt-1 text-wood-600">{formatReservationDateTime(r)}</p>
                    <p className="mt-0.5 text-sm text-wood-500">{Number(r.party_size) === 1 ? "1 guest" : `${r.party_size} guests`}</p>
                    <p className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-200 capitalize">
                        {formatStatus(r.status)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
        <p className="mt-6">
          <Link href="/book" className="text-wood-600 underline hover:text-wood-900">Book another table</Link>
        </p>
      </main>
    </div>
  );
}
