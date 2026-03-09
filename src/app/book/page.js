"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getRestaurant, createReservation, getAvailability } from "@/lib/api";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "9";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Get day_of_week string for a date (YYYY-MM-DD) */
function getDayOfWeekForDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return DAY_NAMES[date.getDay()];
}

/** Check if the restaurant is open on this day (has at least one slot with open/close times) */
function isDayOpen(openingSlots, dateStr) {
  if (!openingSlots || openingSlots.length === 0) return true; // no data = show all
  const day = getDayOfWeekForDate(dateStr);
  const daySlots = openingSlots.filter((s) => (s.day_of_week || "").toLowerCase() === day);
  return daySlots.some(
    (s) =>
      (s.open_time && s.close_time) ||
      (s.open_time_2 && s.close_time_2) ||
      (s.second_open && s.second_close)
  );
}

/** Full-day time slots (8:00–23:00, every 30 min) for the time panel */
const FULL_DAY_TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 8; h <= 23; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 23) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

/** Parse time string "HH:mm" or "HH:mm:ss" to minutes */
function parseTimeToMinutes(str) {
  if (!str || typeof str !== "string") return 0;
  const parts = str.trim().split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  return Number.isNaN(h) ? 0 : h * 60 + m;
}

/** Get time slots for the day from opening hours — supports multiple slots per day (e.g. lunch + dinner) and alternate fields (open_time_2, close_time_2) */
function getTimeSlotsForDay(openingSlots, dateStr) {
  if (!openingSlots || openingSlots.length === 0) return FULL_DAY_TIME_SLOTS;
  const day = getDayOfWeekForDate(dateStr);
  const daySlots = openingSlots.filter((s) => (s.day_of_week || "").toLowerCase() === day);
  if (daySlots.length === 0) return FULL_DAY_TIME_SLOTS;
  const minuteSet = new Set();
  daySlots.forEach((s) => {
    const ranges = [];
    if (s.open_time && s.close_time) ranges.push([s.open_time, s.close_time]);
    if (s.open_time_2 && s.close_time_2) ranges.push([s.open_time_2, s.close_time_2]);
    if (s.second_open && s.second_close) ranges.push([s.second_open, s.second_close]);
    ranges.forEach(([openStr, closeStr]) => {
      const openMinutes = parseTimeToMinutes(openStr);
      const closeMinutes = parseTimeToMinutes(closeStr);
      const startMinutes = Math.ceil(openMinutes / 30) * 30;
      for (let m = startMinutes; m < closeMinutes; m += 30) {
        if (m >= 0 && m < 24 * 60) minuteSet.add(m);
      }
    });
  });
  const fromSlots = Array.from(minuteSet)
    .sort((a, b) => a - b)
    .map((m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return fromSlots.length > 0 ? fromSlots : FULL_DAY_TIME_SLOTS;
}

/** Next 7 days, filtered to open days only */
function buildDateOptions(days = 7, openingSlots) {
  const options = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  let added = 0;
  for (let i = 0; added < days && i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const value = `${y}-${m}-${dayNum}`;
    if (!isDayOpen(openingSlots, value)) continue;
    options.push({
      value,
      label: formatter.format(d),
      isToday: i === 0,
    });
    added++;
  }
  return options;
}

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function BookPage() {
  const { user, token, isAuthenticated } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [openingSlots, setOpeningSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availabilitySlots, setAvailabilitySlots] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reservationConfigMissing, setReservationConfigMissing] = useState(false);
  
  const [reservation_date, setReservation_date] = useState("");
  const [reservation_time, setReservation_time] = useState("12:00");
  const [party_size, setParty_size] = useState(2);
  const [customer_name, setCustomer_name] = useState("");
  const [confirmation_phone, setConfirmation_phone] = useState("");
  const [customer_email, setCustomer_email] = useState("");
  const [notes, setNotes] = useState("");
  const [reservationResult, setReservationResult] = useState(null);

  useEffect(() => {
    getRestaurant(RESTAURANT_ID)
      .then((data) => {
        setRestaurant(data?.restaurant ?? null);
        setOpeningSlots(data?.opening_hours?.opening_slots ?? []);
      })
      .catch(() => {
        setRestaurant(null);
        setOpeningSlots([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Default date to today (client-only)
  useEffect(() => {
    if (!reservation_date) {
      const t = new Date();
      setReservation_date(
        `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
      );
    }
  }, []);

  const dateOptions = useMemo(() => buildDateOptions(7, openingSlots), [openingSlots]);

  // If current date is a closed day, switch to first open day
  useEffect(() => {
    if (dateOptions.length > 0 && reservation_date && !dateOptions.some((o) => o.value === reservation_date)) {
      setReservation_date(dateOptions[0].value);
    }
  }, [dateOptions, reservation_date]);

  // Fetch available time slots from API (date + party_size)
  useEffect(() => {
    if (!reservation_date || !party_size) {
      setAvailabilitySlots(null);
      return;
    }
    setAvailabilityLoading(true);
    setAvailabilitySlots(null);
    getAvailability(RESTAURANT_ID, {
      date: reservation_date,
      party_size: Number(party_size),
    })
      .then((data) => {
        setReservationConfigMissing(false);
        const raw = data?.available_slots ?? [];
        const normalized = raw.map((t) => {
          if (typeof t !== "string") return t;
          const trimmed = t.replace(/\.\d+Z?$/i, "").trim();
          const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
          return match ? `${String(parseInt(match[1], 10)).padStart(2, "0")}:${match[2]}` : trimmed.slice(0, 5);
        });
        setAvailabilitySlots(normalized);
      })
      .catch((err) => {
        if (err?.data?.code === "reservation_config_missing") {
          setReservationConfigMissing(true);
        } else {
          setReservationConfigMissing(false);
        }
        setAvailabilitySlots([]);
      })
      .finally(() => setAvailabilityLoading(false));
  }, [reservation_date, party_size]);

  useEffect(() => {
    if (user) {
      setCustomer_name(user.name ?? "");
      setCustomer_email(user.email ?? "");
    }
  }, [user]);

  // Guests can book; they must provide name and at least one of phone or email.

  function validateGuestContact() {
    const nameOk = (customer_name || "").trim().length > 0;
    const hasPhone = (confirmation_phone || "").trim().length > 0;
    const hasEmail = (customer_email || "").trim().length > 0;
    if (!nameOk) {
      setError("Please enter your name.");
      return false;
    }
    if (!isAuthenticated && !hasPhone && !hasEmail) {
      setError("As a guest, please provide at least your phone number or email.");
      return false;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validateGuestContact()) return;
    setSubmitting(true);
    try {
      const body = {
        restaurant_id: Number(RESTAURANT_ID),
        reservation_date,
        reservation_time,
        party_size: Number(party_size),
        customer_name: (customer_name || "").trim(),
        confirmation_phone: (confirmation_phone || "").trim() || undefined,
        customer_email: (customer_email || "").trim() || undefined,
        notes: (notes || "").trim() || undefined,
      };
      const data = await createReservation(token || undefined, body);
      const reservation = data?.data ?? data;
      setReservationResult(reservation);
    } catch (err) {
      if (err?.data?.code === "reservation_config_missing") {
        setReservationConfigMissing(true);
      }
      setError(
        err?.data?.message ||
        (err?.data?.errors ? Object.values(err.data.errors).flat().join(" ") : null) ||
        err?.message ||
        "Failed to create reservation"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const timeSlotsForDay = useMemo(
    () => getTimeSlotsForDay(openingSlots, reservation_date || ""),
    [openingSlots, reservation_date]
  );

  // Always show all time slots for the day (both lunch and dinner etc.); use API to mark which are bookable
  const timeSlotsToShow = timeSlotsForDay;
  const availableSlotsSet = useMemo(() => {
    if (!availabilitySlots || availabilitySlots.length === 0) return null;
    return new Set(
      availabilitySlots.map((t) => {
        const s = typeof t === "string" ? t.replace(/\.\d+Z?$/i, "").trim() : "";
        const match = s.match(/^(\d{1,2}):(\d{2})/);
        return match ? `${String(parseInt(match[1], 10)).padStart(2, "0")}:${match[2]}` : s.slice(0, 5);
      })
    );
  }, [availabilitySlots]);

  // Keep selected time valid when slots change
  useEffect(() => {
    if (!reservation_date || timeSlotsToShow.length === 0) return;
    if (!timeSlotsToShow.includes(reservation_time)) {
      setReservation_time(timeSlotsToShow[0]);
    }
  }, [reservation_date, timeSlotsToShow, reservation_time]);

  const isToday = reservation_date && (() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return reservation_date === `${y}-${m}-${d}`;
  })();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isTimeSlotPast = (slot) => {
    if (!isToday) return false;
    const [h, m] = slot.split(":").map(Number);
    return h * 60 + m <= currentMinutes;
  };

  if (loading || !restaurant) {
    return (
      <div className="min-h-screen bg-wood-100">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-wood-600">Loading...</p>
        </main>
      </div>
    );
  }

  if (reservationResult) {
    const r = reservationResult;
    const dateStr = r.reservation_date || r.date;
    const timeStr = (r.reservation_time || r.time || "").toString().replace(/\.\d+Z?$/i, "").slice(0, 5);
    return (
      <div className="min-h-screen bg-wood-100">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">
          <div className="glass rounded-2xl border border-white/10 p-6 md:p-8 text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-wood-900">Booking request received</h1>
            <p className="mt-2 text-wood-700">
              {restaurant?.name} — {dateStr} at {timeStr || "—"}, party of {r.party_size ?? party_size}
            </p>
            <p className="mt-4 text-sm text-wood-600">
              {isAuthenticated
                ? "You can view and manage your reservations in your account."
                : "If you provided an email, you will receive a confirmation once the restaurant confirms your table. To track your booking in your account, log in with the same email."}
            </p>
            {!isAuthenticated && (
              <p className="mt-2 text-sm text-wood-600">
                <Link href="/login" className="font-medium text-wood-800 underline hover:no-underline dark:text-wood-200">Log in</Link> to see and manage your reservations.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {isAuthenticated ? (
                <Link
                  href="/reservations"
                  className="touch-manipulation min-h-[44px] rounded-full bg-accent px-6 py-3 font-semibold text-wood-950 shadow-md hover:bg-accent-hover"
                >
                  View my reservations
                </Link>
              ) : null}
              <Link
                href="/"
                className="touch-manipulation min-h-[44px] rounded-full bg-white/10 px-6 py-3 font-semibold text-wood-900 border border-white/10 hover:bg-white/15"
              >
                Back to Restaurant
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">
        <Link
          href="/"
          className="touch-manipulation mb-4 inline-flex min-h-[44px] items-center rounded-lg px-3 py-2.5 text-base font-medium text-wood-600 hover:bg-white/10 hover:text-wood-900 transition-colors"
        >
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Restaurant
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-wood-900">
            Book a Table
          </h1>
          <p className="mt-1 text-wood-600">at {restaurant.name}</p>
        </div>

        {!isAuthenticated && (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Booking as guest: please enter your name and at least one of phone or email.
            {" "}
            <span className="text-amber-100">To track your booking, <Link href="/login" className="font-medium underline hover:no-underline">log in</Link> before or after submitting.</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="glass flex flex-col gap-4 rounded-2xl p-4 border border-white/10 md:p-5 text-wood-900">
          {reservationConfigMissing && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <p className="font-medium">Reservations not available yet</p>
              <p className="mt-1 text-amber-200/90">
                This restaurant has not set up reservation settings. The owner needs to add reservation configuration and opening hours in the dashboard. Please contact the restaurant or try again later.
              </p>
            </div>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {/* Date, Time, Party — wider row on large screens */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Date — this week only */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur-sm">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-wood-900">
              <svg className="h-4 w-4 shrink-0 text-wood-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Date
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dateOptions.map((opt) => {
                const selected = reservation_date === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReservation_date(opt.value)}
                    className={`touch-manipulation min-h-[44px] rounded-full px-4 py-2.5 text-base font-semibold transition-all active:scale-[0.98] ${
                      selected
                        ? "bg-accent text-wood-950 shadow-md ring-2 ring-accent ring-offset-2 ring-offset-wood-200/50"
                        : "bg-white/10 text-wood-800 border border-white/10 hover:bg-white/15"
                    } ${opt.isToday && !selected ? "ring-1 ring-accent/60" : ""}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-1.5 text-xs font-medium text-wood-600">Or choose another date</p>
              <input
                type="date"
                value={reservation_date}
                onChange={(e) => setReservation_date(e.target.value)}
                min={(() => {
                  const t = new Date();
                  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
                })()}
                className="touch-manipulation min-h-[48px] w-full max-w-xs rounded-lg border border-wood-500/40 bg-white/10 px-4 py-3 text-base text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>

          {/* Time — from availability API when available, else opening hours */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur-sm">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-wood-900">
              <svg className="h-4 w-4 shrink-0 text-wood-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availabilityLoading && (
                <p className="w-full text-sm text-wood-600">Loading availability…</p>
              )}
              {timeSlotsToShow.length === 0 ? (
                <p className="text-sm text-wood-600">No times for this day.</p>
              ) : (
                timeSlotsToShow.map((slot) => {
                  const selected = reservation_time === slot;
                  const isPast = isTimeSlotPast(slot);
                  const isUnavailable = party_size >= 10 && availableSlotsSet !== null && !availableSlotsSet.has(slot);
                  const disabled = isPast || isUnavailable;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setReservation_time(slot)}
                      title={isUnavailable ? "Not available" : undefined}
                      className={`touch-manipulation min-h-[44px] rounded-full px-4 py-2.5 text-base font-semibold transition-all active:scale-[0.98] ${
                        disabled
                          ? "cursor-not-allowed bg-white/20 text-wood-500"
                          : selected
                            ? "bg-accent text-wood-950 shadow-md ring-2 ring-accent ring-offset-2 ring-offset-wood-200/50"
                            : "bg-white/10 text-wood-800 border border-white/10 hover:bg-white/15"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Party size — pills */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur-sm">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-wood-900">
              <svg className="h-4 w-4 shrink-0 text-wood-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Party size
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PARTY_SIZES.map((n) => {
                const selected = party_size === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setParty_size(n)}
                    className={`touch-manipulation min-h-[44px] rounded-full px-4 py-2.5 text-base font-semibold transition-all active:scale-[0.98] ${
                      selected
                        ? "bg-accent text-wood-950 shadow-md ring-2 ring-accent ring-offset-2 ring-offset-wood-200/50"
                        : "bg-white/10 text-wood-800 border border-white/10 hover:bg-white/15"
                    }`}
                  >
                    {n} {n === 1 ? "guest" : "guests"}
                  </button>
                );
              })}
            </div>
          </div>
          </div>

          <div className="my-2 border-t border-white/10"></div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-wood-700">Your name</span>
              <input
                type="text"
                value={customer_name}
                onChange={(e) => setCustomer_name(e.target.value)}
                required
                className="touch-manipulation min-h-[48px] w-full rounded-lg border border-wood-500/40 bg-white/10 px-4 py-3 text-base text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-wood-700">Phone {!isAuthenticated ? "(required if no email)" : ""}</span>
              <input
                type="tel"
                value={confirmation_phone}
                onChange={(e) => setConfirmation_phone(e.target.value)}
                className="touch-manipulation min-h-[48px] w-full rounded-lg border border-wood-500/40 bg-white/10 px-4 py-3 text-base text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-wood-700">Email {!isAuthenticated ? "(required if no phone)" : "(optional)"}</span>
            <input
              type="email"
              value={customer_email}
              onChange={(e) => setCustomer_email(e.target.value)}
              className="touch-manipulation min-h-[48px] w-full rounded-xl border border-wood-500/40 bg-white/10 px-4 py-3 text-base text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-wood-700">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Allergies, special requests..."
              className="touch-manipulation min-h-[48px] w-full rounded-xl border border-wood-500/40 bg-white/10 px-4 py-3 text-base text-wood-900 placeholder-wood-500 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || reservationConfigMissing}
            className="touch-manipulation mt-2 min-h-[52px] w-full rounded-full bg-accent py-4 text-lg font-semibold text-wood-950 shadow-md hover:bg-accent-hover disabled:opacity-50 active:scale-[0.98] transition-colors"
          >
            {submitting ? "Confirming..." : reservationConfigMissing ? "Booking unavailable" : "Confirm Booking"}
          </button>
        </form>
      </main>
    </div>
  );
}
