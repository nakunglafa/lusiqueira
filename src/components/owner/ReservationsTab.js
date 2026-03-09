"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getOwnerRestaurantReservations,
  updateReservationStatus,
} from "@/lib/api";
import { toArray } from "@/lib/owner-utils";

function getReservationDate(r) {
  const res = r?.reservation ?? r;
  const possibleIso =
    res.reservation_datetime ??
    res.datetime ??
    res.date_time ??
    res.reservation_time ??
    res.reservationTime ??
    res.scheduled_at ??
    res.booking_datetime ??
    res.reservation_date ??
    res.date;
  if (possibleIso && typeof possibleIso === "string" && possibleIso.includes("T")) {
    const normalized = possibleIso.replace(/\.(\d{4,})Z?$/i, (_, frac) => `.${frac.slice(0, 3)}Z`);
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const dateStr = (res.reservation_date ?? res.reservationDate ?? res.date ?? res.booking_date ?? res.booking?.date ?? "").toString().trim();
  const timeStr = (res.reservation_time ?? res.reservationTime ?? res.time ?? res.booking_time ?? res.booking?.time ?? "").toString().trim();
  if (!dateStr) {
    if (timeStr && timeStr.includes("T")) {
      const d = new Date(timeStr);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const normalized = dateStr.replace(/^(\d{4})-(\d{2})-(\d{2}).*/, "$1-$2-$3");
  if (!normalized || normalized.length < 10) return null;
  const [y, m, day] = normalized.split("-").map(Number);
  let timePart = timeStr ? timeStr.replace(/\.\d+Z?$/i, "").replace(/:$/, "").slice(0, 8) : "00:00:00";
  if (timePart && timePart.length === 5) timePart += ":00";
  const [h = 0, min = 0, sec = 0] = (timePart || "00:00:00").split(":").map(Number);
  const d = new Date(y, m - 1, day, h, min, sec);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(r) {
  const d = getReservationDate(r);
  if (!d || Number.isNaN(d.getTime())) {
    return formatDateTimeFallback(r);
  }
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

/** Fallback when getReservationDate fails - try to show date/time from any common field */
function formatDateTimeFallback(r) {
  const rawDate = (r.reservation_date ?? r.reservationDate ?? r.date ?? r.booking_date ?? r.booking?.date ?? r.scheduled_date ?? "").toString().trim();
  const rawTime = (r.reservation_time ?? r.reservationTime ?? r.time ?? r.booking_time ?? r.booking?.time ?? r.scheduled_time ?? "").toString().trim();
  const rawIso = (r.reservation_datetime ?? r.datetime ?? r.reservation_time ?? r.reservationTime ?? r.scheduled_at ?? r.booking_datetime ?? "").toString().trim();
  if (rawIso) {
    const d = new Date(rawIso);
    if (!Number.isNaN(d.getTime())) {
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
  }
  if (rawDate) {
    const d = new Date(rawDate + (rawTime ? `T${rawTime}` : ""));
    if (!Number.isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const timeStr = rawTime ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true }) : "";
      return timeStr ? `${dateStr} at ${timeStr}` : dateStr;
    }
    return [rawDate, rawTime].filter(Boolean).join(" ");
  }
  return "";
}

/** Get human-readable date/time - tries formatDateTime, then getRawDateTime, then raw values */
function getDisplayDateTime(r) {
  const formatted = formatDateTime(r);
  if (formatted) return formatted;
  const raw = getRawDateTime(r);
  if (raw) return raw;
  const parts = [
    r.reservation_date ?? r.date ?? r.booking_date,
    r.reservation_time ?? r.time ?? r.booking_time,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "";
}

/** Last-resort: show any date-like value from the reservation object */
function getRawDateTime(r) {
  const keys = [
    "reservation_datetime", "datetime", "scheduled_at", "booking_datetime",
    "reservation_date", "date", "reservation_time", "time",
    "booking_date", "booking_time", "scheduled_date", "scheduled_time",
    "created_at", "starts_at", "start_time",
    "reservationDate", "reservationTime", "bookingDate", "bookingTime",
  ];
  for (const k of keys) {
    const v = r?.[k];
    if (v && typeof v === "string") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
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
    }
  }
  const datePart = (r?.reservation_date ?? r?.date ?? r?.reservationDate ?? "").toString().trim();
  const timePart = (r?.reservation_time ?? r?.time ?? r?.reservationTime ?? "").toString().trim();
  if (datePart || timePart) return [datePart, timePart].filter(Boolean).join(" ");
  return "";
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

const HISTORY_PAGE_SIZE = 10;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function ReservationsTab({ restaurantId, reservations: reservationsProp, onRefresh }) {
  const { token } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mainTab, setMainTab] = useState("upcoming");
  const [upcomingSubTab, setUpcomingSubTab] = useState("pending");
  const [historyPage, setHistoryPage] = useState(1);

  // Use parent's reservations when provided (enables real-time refresh from OwnerRefreshContext)
  const displayReservations = reservationsProp != null && Array.isArray(reservationsProp)
    ? reservationsProp
    : reservations;

  const loadReservations = useCallback(() => {
    if (!token || !restaurantId) return;
    setLoading(true);
    setError("");
    getOwnerRestaurantReservations(token, restaurantId)
      .then((res) => setReservations(toArray(res)))
      .catch((err) => {
        setError(err?.data?.message || err?.message || "Failed to load reservations");
        setReservations([]);
      })
      .finally(() => setLoading(false));
  }, [token, restaurantId]);

  useEffect(() => {
    if (reservationsProp != null && Array.isArray(reservationsProp)) {
      setLoading(false);
      return;
    }
    loadReservations();
  }, [loadReservations, reservationsProp]);

  async function handleStatusChange(reservationId, newStatus) {
    if (!token || !restaurantId) return;
    try {
      await updateReservationStatus(token, restaurantId, reservationId, newStatus);
      if (onRefresh) onRefresh();
      else loadReservations();
    } catch (err) {
      setError(err?.data?.message || err?.message || "Failed to update status");
    }
  }

  if (loading) return <p className="py-8 text-owner-muted">Loading reservations...</p>;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={loadReservations}
          className="touch-manipulation mt-2 min-h-[48px] rounded-xl bg-red-100 px-4 py-3 text-base md:text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          Try again
        </button>
      </div>
    );
  }

  const now = Date.now();
  const todayStart = (() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  })();
  const { upcoming, history } = (() => {
    const up = [];
    const hist = [];
    displayReservations.forEach((r) => {
      const d = getReservationDate(r);
      if (!d) {
        up.push(r);
        return;
      }
      const resDateStart = new Date(d);
      resDateStart.setHours(0, 0, 0, 0);
      const isPast =
        resDateStart.getTime() < todayStart ||
        d.getTime() < now;
      if (isPast) {
        hist.push(r);
      } else {
        up.push(r);
      }
    });
    up.sort((a, b) => (getReservationDate(a)?.getTime() ?? 0) - (getReservationDate(b)?.getTime() ?? 0));
    hist.sort((a, b) => (getReservationDate(b)?.getTime() ?? 0) - (getReservationDate(a)?.getTime() ?? 0));
    return { upcoming: up, history: hist };
  })();

  const pending = upcoming.filter((r) => (r.status || "pending") === "pending");
  const confirmed = upcoming.filter((r) => (r.status || "").toLowerCase() === "confirmed");

  const upcomingFiltered =
    upcomingSubTab === "pending"
      ? pending
      : upcomingSubTab === "confirmed"
      ? confirmed
      : upcoming;

  const oneWeekAgo = now - ONE_WEEK_MS;
  const historyFiltered = history.filter((r) => {
    const d = getReservationDate(r);
    return d && d.getTime() >= oneWeekAgo;
  });

  const historyTotalPages = Math.max(1, Math.ceil(historyFiltered.length / HISTORY_PAGE_SIZE));
  const historyPaginated = historyFiltered.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE
  );

  const displayList = mainTab === "upcoming" ? upcomingFiltered : historyPaginated;

  return (
    <div className="space-y-4">
      {/* Main tabs: Upcoming | History */}
      <div className="flex gap-2 rounded-xl bg-owner-paper p-1.5 border border-owner-border">
        <button
          type="button"
          onClick={() => setMainTab("upcoming")}
          className={`touch-manipulation min-h-[48px] flex-1 rounded-lg px-4 py-3 text-base md:text-sm font-medium transition-colors active:scale-[0.98] ${
            mainTab === "upcoming"
              ? "bg-owner-action text-white shadow"
              : "text-owner-charcoal hover:bg-owner-paper"
          }`}
        >
          Upcoming
          {(upcoming.length > 0) && (
            <span className="ml-1.5 rounded-full bg-owner-border px-1.5 py-0.5 text-xs text-owner-charcoal">
              {upcoming.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setMainTab("history"); setHistoryPage(1); }}
          className={`touch-manipulation min-h-[48px] flex-1 rounded-lg px-4 py-3 text-base md:text-sm font-medium transition-colors active:scale-[0.98] ${
            mainTab === "history"
              ? "bg-owner-action text-white shadow"
              : "text-owner-charcoal hover:bg-owner-paper"
          }`}
        >
          History
          {(history.length > 0) && (
            <span className="ml-1.5 rounded-full bg-owner-border px-1.5 py-0.5 text-xs text-owner-charcoal">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Upcoming sub-tabs: All | Pending | Confirmed (only when Upcoming is selected) */}
      {mainTab === "upcoming" && (
        <div className="flex flex-wrap gap-2 rounded-xl bg-owner-paper p-1.5 border border-owner-border">
          <button
            type="button"
            onClick={() => setUpcomingSubTab("all")}
            className={`touch-manipulation min-h-[48px] flex-1 min-w-[70px] rounded-lg px-4 py-3 text-base md:text-sm font-medium transition-colors active:scale-[0.98] ${
              upcomingSubTab === "all"
                ? "bg-zinc-100 text-white shadow dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            All
            {(upcoming.length > 0) && (
              <span className="ml-1 rounded-full bg-owner-border px-1.5 py-0.5 text-xs text-owner-charcoal">
                {upcoming.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setUpcomingSubTab("pending")}
            className={`touch-manipulation min-h-[48px] flex-1 min-w-[70px] rounded-lg px-4 py-3 text-base md:text-sm font-medium transition-colors active:scale-[0.98] ${
              upcomingSubTab === "pending"
                ? "bg-zinc-100 text-white shadow dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Pending
            {(pending.length > 0) && (
              <span className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-xs dark:bg-amber-900/50">
                {pending.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setUpcomingSubTab("confirmed")}
            className={`touch-manipulation min-h-[48px] flex-1 min-w-[70px] rounded-lg px-4 py-3 text-base md:text-sm font-medium transition-colors active:scale-[0.98] ${
              upcomingSubTab === "confirmed"
                ? "bg-zinc-100 text-white shadow dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Confirmed
            {(confirmed.length > 0) && (
              <span className="ml-1 rounded-full bg-owner-success/30 px-1.5 py-0.5 text-xs text-owner-charcoal">
                {confirmed.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* History: Last 7 days + Pagination */}
      {mainTab === "history" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base md:text-sm text-owner-muted">Last 7 days</p>
          {(historyFiltered.length > HISTORY_PAGE_SIZE) && (
            <div className="flex items-center gap-3 text-base md:text-sm text-owner-muted">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="touch-manipulation min-h-[48px] min-w-[100px] rounded-xl border border-owner-border px-4 py-3 font-medium text-owner-charcoal hover:bg-owner-paper disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="font-medium">
                Page {historyPage} of {historyTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                disabled={historyPage >= historyTotalPages}
                className="touch-manipulation min-h-[48px] min-w-[100px] rounded-xl border border-owner-border px-4 py-3 font-medium text-owner-charcoal hover:bg-owner-paper disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {displayList.length === 0 ? (
        <p className="py-8 text-owner-muted">
          {mainTab === "history"
            ? "No past reservations."
            : upcomingSubTab === "pending"
            ? "No pending reservations."
            : upcomingSubTab === "confirmed"
            ? "No confirmed reservations."
            : "No upcoming reservations."}
        </p>
      ) : (
        <ul className="space-y-3">
          {displayList.map((r) => {
            const d = getReservationDate(r);
            const isPast = d && d.getTime() < now;
            return (
              <li
                key={r.id}
                className={`rounded-xl border p-4 ${
                  isPast
                    ? "border-owner-border bg-owner-paper"
                    : "owner-card border border-owner-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-owner-charcoal">
                      {r.customer_name ?? r.user?.name ?? "Guest"}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-owner-muted">
                      {getDisplayDateTime(r) || "Date & time not available"}
                    </p>
                    <p className="mt-0.5 text-sm text-owner-muted">
                      {r.party_size ?? 1} {Number(r.party_size) === 1 ? "guest" : "guests"}
                    </p>
                    {r.special_requests && (
                      <p className="mt-1 text-sm text-owner-muted">
                        {r.special_requests}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        r.status === "confirmed"
                          ? "bg-owner-success/20 text-owner-success"
                          : r.status === "cancelled"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          : r.status === "completed"
                          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {r.status || "pending"}
                    </span>
                    {!isPast && r.status !== "cancelled" && r.status !== "completed" && (
                      <select
                        value={r.status || "pending"}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        className="touch-manipulation min-h-[48px] min-w-[120px] rounded-xl border border-owner-border bg-owner-card px-4 py-3 text-base md:text-sm font-medium text-owner-charcoal"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
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
