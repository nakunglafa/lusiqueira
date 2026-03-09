"use client";

import { useState, useEffect } from "react";
import {
  getRestaurantById,
  getRestaurantConfig,
  getRestaurantPaymentConfig,
  updateOwnerRestaurant,
  updateRestaurantConfig,
  updateRestaurantPaymentConfig,
  updateOpeningSlots,
} from "@/lib/api";
import { setKeepScreenOnPreference } from "@/hooks/useScreenWakeLock";
import { ImageUploadDropzone } from "@/components/owner/ImageUploadDropzone";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function generateTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    }
  }
  return options;
}

export function SettingsTab({ restaurantId, token, restaurant, onRefresh, onRestaurantUpdate, keepScreenOn = false, onKeepScreenOnChange }) {
  const [config, setConfig] = useState(null);
  const [slotsByDay, setSlotsByDay] = useState(() =>
    DAYS.reduce((acc, d) => ({ ...acc, [d]: [] }), {})
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editRestaurant, setEditRestaurant] = useState({ name: "", address: "", phone: "", google_business_url: "", logo_url: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoCacheBust, setLogoCacheBust] = useState(0);
  const [editConfig, setEditConfig] = useState({
    default_reservation_duration: 90,
    max_party_size: 10,
    reservation_start_buffer: 0,
    reservation_end_buffer: 0,
  });
  const [paymentConfig, setPaymentConfig] = useState({
    stripe_enabled: true,
    pickup_enabled: true,
  });
  /** Auto-clear success after 5s */
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 5000);
    return () => clearTimeout(t);
  }, [success]);

  /** Parse API opening_slots (array, possibly multiple per day) into slotsByDay */
  const apiSlotsToSlotsByDay = (rawSlots) => {
    const arr = Array.isArray(rawSlots) ? rawSlots : [];
    const toHhMmSs = (t) =>
      t && typeof t === "string"
        ? t.length === 5
          ? `${t}:00`
          : t
        : "09:00:00";
    return DAYS.reduce((acc, day) => {
      const daySlots = arr
        .filter((s) => (s.day_of_week || s.day || "").toLowerCase() === day)
        .sort((a, b) =>
          (toHhMmSs(a.open_time) || "").localeCompare(toHhMmSs(b.open_time) || "")
        )
        .map((s) => ({
          open_time: toHhMmSs(s.open_time),
          close_time: toHhMmSs(s.close_time),
        }));
      acc[day] = daySlots.length ? daySlots : [];
      return acc;
    }, {});
  };

  /** Convert slotsByDay back to API slots array. Match admin edit page: send HH:MM:SS. */
  const slotsByDayToApi = (byDay) => {
    const toHhMmSs = (t, fallback) => {
      const s = (t || fallback).length === 5 ? `${t}:00` : t || fallback;
      return s;
    };
    return Object.entries(byDay).flatMap(([day, slots]) =>
      (slots || []).map((slot) => ({
        day_of_week: day,
        open_time: toHhMmSs(slot.open_time, "09:00:00"),
        close_time: toHhMmSs(slot.close_time, "17:00:00"),
      }))
    );
  };

  useEffect(() => {
    if (!restaurantId || !token) return;
    setLoading(true);
    setError("");
    const restPromise = restaurant ? Promise.resolve(restaurant) : getRestaurantById(restaurantId, token);
    const paymentPromise = getRestaurantPaymentConfig(token, restaurantId).catch(() => null);
    const configPromise = getRestaurantConfig(token, restaurantId).catch((err) => {
      if (err?.status === 404) return { data: null, noConfig: true };
      throw err;
    });

    Promise.all([configPromise, restPromise, paymentPromise])
      .then(([configRes, restRes, paymentRes]) => {
        const cfg = configRes?.data ?? configRes;
        const rest = restRes?.data ?? restRes ?? restRes?.restaurant ?? restRes;
        const pay = paymentRes?.data ?? paymentRes;

        if (configRes?.noConfig || !cfg) {
          setSlotsByDay(apiSlotsToSlotsByDay([]));
        } else {
          setConfig(cfg);
          const rawSlots =
            cfg?.opening_slots ??
            cfg?.slots ??
            cfg?.data?.opening_slots ??
            [];
          setSlotsByDay(apiSlotsToSlotsByDay(rawSlots));
          setEditConfig({
            default_reservation_duration: cfg?.configuration?.default_reservation_duration ?? cfg?.default_reservation_duration ?? 90,
            max_party_size: cfg?.configuration?.max_party_size ?? cfg?.max_party_size ?? 10,
            reservation_start_buffer: cfg?.configuration?.reservation_start_buffer ?? cfg?.reservation_start_buffer ?? 0,
            reservation_end_buffer: cfg?.configuration?.reservation_end_buffer ?? cfg?.reservation_end_buffer ?? 0,
          });
        }

        if (pay) {
          setPaymentConfig({
            stripe_enabled: pay?.stripe_enabled ?? true,
            pickup_enabled: pay?.pickup_enabled ?? true,
          });
        }
        setEditRestaurant({
          name: rest?.name ?? "",
          address: rest?.address ?? "",
          phone: rest?.phone ?? "",
          google_business_url: rest?.google_business_url ?? "",
          logo_url: rest?.logo_url ?? "",
        });
      })
      .catch((err) => setError(err?.message || err?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [restaurantId, token, restaurant?.id]);

  const handleSaveRestaurant = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const id = restaurant?.id ?? restaurantId;
      let res;
      if (logoFile instanceof File && logoFile.size > 0) {
        const fd = new FormData();
        fd.append("_method", "PUT");
        fd.append("name", editRestaurant.name);
        fd.append("address", editRestaurant.address);
        fd.append("phone", editRestaurant.phone);
        fd.append("google_business_url", editRestaurant.google_business_url || "");
        fd.append("logo", logoFile);
        res = await updateOwnerRestaurant(id, fd, token);
        setLogoFile(null);
        setLogoCacheBust(Date.now());
      } else {
        res = await updateOwnerRestaurant(id, editRestaurant, token);
      }
      const updated = res?.data ?? res?.restaurant ?? res;
      if (updated && typeof updated === "object") {
        const merged = {
          name: updated.name ?? editRestaurant.name,
          address: updated.address ?? editRestaurant.address,
          phone: updated.phone ?? editRestaurant.phone,
          google_business_url: updated.google_business_url ?? editRestaurant.google_business_url,
          logo_url: updated.logo_url ?? editRestaurant.logo_url,
        };
        setEditRestaurant(merged);
        onRestaurantUpdate?.({ ...updated, ...merged });
      } else {
        // API returned success but no restaurant object – propagate form values optimistically
        onRestaurantUpdate?.({
          name: editRestaurant.name,
          address: editRestaurant.address,
          phone: editRestaurant.phone,
          google_business_url: editRestaurant.google_business_url,
          logo_url: editRestaurant.logo_url,
        });
      }
      setSuccess("Restaurant details updated.");
      // Don't call onRefresh here – it can overwrite with stale cached data; parent is already updated via onRestaurantUpdate
    } catch (err) {
      const msg = err?.data?.message || err?.message || "Failed to update";
      const validationErrors = err?.data?.errors;
      const detail = validationErrors && typeof validationErrors === "object"
        ? Object.values(validationErrors).flat().join(" ")
        : "";
      setError(detail ? `${msg}: ${detail}` : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateRestaurantConfig(token, restaurantId, editConfig);
      setSuccess("Reservation config updated.");
    } catch (err) {
      setError(err?.message || err?.data?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlots = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const apiSlots = slotsByDayToApi(slotsByDay);
      const res = await updateOpeningSlots(token, restaurantId, { slots: apiSlots });
      const savedSlots =
        res?.data?.opening_slots ?? res?.opening_slots ?? res?.data ?? null;
      if (Array.isArray(savedSlots) && savedSlots.length >= 0) {
        setSlotsByDay(apiSlotsToSlotsByDay(savedSlots));
      }
      setSuccess("Opening hours updated.");
    } catch (err) {
      const msg = err?.message || err?.data?.message || "Failed to update";
      const validationErrors = err?.data?.errors;
      const detail =
        validationErrors && typeof validationErrors === "object"
          ? Object.values(validationErrors).flat().join(" ")
          : "";
      setError(detail ? `${msg}: ${detail}` : msg);
    } finally {
      setSaving(false);
    }
  };

  const copyDayToAll = (fromDay) => {
    const sourceSlots = (slotsByDay[fromDay] || []).map((s) => ({
      open_time: (s.open_time || "09:00:00").length === 5 ? `${s.open_time}:00` : s.open_time || "09:00:00",
      close_time: (s.close_time || "17:00:00").length === 5 ? `${s.close_time}:00` : s.close_time || "17:00:00",
    }));
    const next = { ...slotsByDay };
    DAYS.forEach((d) => {
      next[d] = sourceSlots.length ? sourceSlots.map((slot) => ({ ...slot })) : [];
    });
    setSlotsByDay(next);
    setSuccess("Opening hours copied to all days.");
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateRestaurantPaymentConfig(token, restaurantId, paymentConfig);
      setSuccess("Payment gateways updated.");
    } catch (err) {
      setError(err?.message || err?.data?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-owner-border bg-owner-card px-4 py-3 text-base md:text-sm text-owner-charcoal placeholder:text-owner-muted sm:rounded-lg sm:py-2 sm:text-sm";
  const labelClass = "block text-sm md:text-xs font-medium text-owner-charcoal mb-1";
  const sectionClass = "owner-card rounded-xl p-6 border border-owner-border";
  const btnPrimaryClass = "touch-manipulation min-h-[48px] w-full rounded-xl bg-owner-action px-5 py-3 text-base md:text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto sm:rounded-lg sm:py-2 sm:text-sm";
  const timeInputClass = "touch-manipulation min-h-[44px] rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-base md:text-sm text-owner-charcoal";

  const navItems = [
    { id: "restaurant-details", label: "Restaurant details" },
    { id: "reservation-rules", label: "Reservation rules" },
    { id: "payment-gateways", label: "Payment gateways" },
    { id: "opening-hours", label: "Opening hours" },
    { id: "device", label: "Device" },
  ];

  if (loading) return <p className="text-owner-charcoal">Loading settings...</p>;

  return (
    <div className="flex flex-col lg:flex-row lg:gap-8">
      {/* Mobile: sticky top horizontal scroll nav – slick, always at top for easy access */}
      <nav
        aria-label="Settings navigation"
        className="lg:hidden sticky top-0 z-20 -mx-4 mb-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 py-3 bg-owner-paper/98 backdrop-blur-md border-b border-owner-border shadow-sm scrollbar-hide snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-2 min-w-max pb-0.5">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="shrink-0 snap-start rounded-lg border border-owner-border bg-owner-card px-4 py-2.5 text-sm md:text-xs font-medium text-owner-charcoal transition-all active:scale-[0.98] hover:bg-owner-paper"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Fixed left nav - desktop only */}
      <nav
        aria-label="Settings navigation"
        className="hidden lg:block lg:w-52 lg:flex-shrink-0 lg:sticky lg:top-36 lg:self-start"
      >
        <div className="owner-card rounded-xl p-3 border border-owner-border">
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-owner-muted">
            Settings
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block rounded-lg px-3 py-2 text-sm md:text-xs font-medium text-owner-charcoal transition-colors hover:bg-owner-paper"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Toast notifications – same position as live notification stack (bottom-right / bottom on mobile) */}
      {(success || error) && (
        <div
          className="fixed bottom-6 right-6 left-auto z-50 flex max-w-sm flex-col gap-2 max-sm:left-4 max-sm:right-4 max-sm:bottom-6 max-sm:pb-[env(safe-area-inset-bottom)]"
          aria-live="polite"
        >
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-white p-4 shadow-lg dark:border-red-800 dark:bg-red-950/95"
              role="alert"
            >
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={() => setError("")}
                className="mt-2 text-xs font-medium text-red-500 underline hover:no-underline dark:text-red-400"
              >
                Dismiss
              </button>
            </div>
          )}
          {success && (
            <div
              className="rounded-xl border border-owner-success/40 bg-white p-4 shadow-lg dark:bg-owner-success/10"
              role="status"
            >
              <p className="text-sm font-medium text-owner-success">{success}</p>
            </div>
          )}
        </div>
      )}

      {/* Main content - scrollable */}
      <div className="min-w-0 flex-1 space-y-8 scroll-smooth">
      <section id="restaurant-details" className={sectionClass}>
        <h3 className="mb-4 text-lg md:text-base font-semibold text-owner-charcoal">
          Restaurant details
        </h3>
        <form onSubmit={handleSaveRestaurant} className="flex flex-col gap-4 max-w-md">
          <label>
            <span className={labelClass}>Name</span>
            <input
              type="text"
              value={editRestaurant.name}
              onChange={(e) => setEditRestaurant((p) => ({ ...p, name: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>Address</span>
            <input
              type="text"
              value={editRestaurant.address}
              onChange={(e) => setEditRestaurant((p) => ({ ...p, address: e.target.value }))}
              className={`touch-manipulation min-h-[48px] ${inputClass}`}
            />
          </label>
          <label>
            <span className={labelClass}>Phone</span>
            <input
              type="text"
              value={editRestaurant.phone}
              onChange={(e) => setEditRestaurant((p) => ({ ...p, phone: e.target.value }))}
              className={`touch-manipulation min-h-[48px] ${inputClass}`}
            />
          </label>
          <label>
            <span className={labelClass}>Google Business URL</span>
            <input
              type="url"
              value={editRestaurant.google_business_url}
              onChange={(e) => setEditRestaurant((p) => ({ ...p, google_business_url: e.target.value }))}
              placeholder="https://..."
              className={`touch-manipulation min-h-[48px] ${inputClass}`}
            />
          </label>
          <div>
            <span className={labelClass}>Restaurant logo</span>
            {(editRestaurant.logo_url || logoFile) && (
              <div className="mb-2 flex items-center gap-3">
                <img
                  src={
                    logoFile
                      ? URL.createObjectURL(logoFile)
                      : editRestaurant.logo_url
                        ? `${editRestaurant.logo_url}${editRestaurant.logo_url.includes("?") ? "&" : "?"}v=${logoCacheBust}`
                        : ""
                  }
                  alt="Logo preview"
                  className="h-16 w-16 rounded-lg object-cover border border-owner-border"
                />
                {logoFile && (
                  <span className="text-sm text-owner-muted">New image selected</span>
                )}
              </div>
            )}
            <ImageUploadDropzone
              id="restaurant-logo-upload"
              label=""
              value={logoFile}
              onChange={setLogoFile}
              onError={setError}
              accept="image/jpeg,image/png,image/jpg"
              dropHint="Drop logo or click to choose (max 500 KB)"
              className="mt-1"
            />
            <span className="mt-1 block text-xs text-owner-muted">JPEG, PNG or JPG, max 500 KB</span>
          </div>
          <button type="submit" disabled={saving} className={btnPrimaryClass}>
            {saving ? "Saving..." : "Save restaurant"}
          </button>
        </form>
      </section>

      <section id="reservation-rules" className={sectionClass}>
        <h3 className="mb-4 text-lg md:text-base font-semibold text-owner-charcoal">
          Reservation rules
        </h3>
        <form onSubmit={handleSaveConfig} className="flex flex-col gap-4 max-w-md">
          <label>
            <span className={labelClass}>Default duration (minutes)</span>
            <input
              type="number"
              min={30}
              max={240}
              value={editConfig.default_reservation_duration}
              onChange={(e) => setEditConfig((p) => ({ ...p, default_reservation_duration: Number(e.target.value) }))}
              className={`touch-manipulation min-h-[48px] ${inputClass}`}
            />
          </label>
          <label>
            <span className={labelClass}>Max party size</span>
            <input
              type="number"
              min={1}
              max={50}
              value={editConfig.max_party_size}
              onChange={(e) => setEditConfig((p) => ({ ...p, max_party_size: Number(e.target.value) }))}
              className={`touch-manipulation min-h-[48px] ${inputClass}`}
            />
          </label>
          <button type="submit" disabled={saving} className={btnPrimaryClass}>
            {saving ? "Saving..." : "Save config"}
          </button>
        </form>
      </section>

      <section id="payment-gateways" className={sectionClass}>
        <h3 className="mb-4 text-lg md:text-base font-semibold text-owner-charcoal">
          Payment gateways
        </h3>
        <form onSubmit={handleSavePayment} className="flex flex-col gap-4 max-w-md">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={paymentConfig.stripe_enabled}
              onChange={(e) => setPaymentConfig((p) => ({ ...p, stripe_enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-owner-action"
            />
            <span className="text-owner-charcoal">Enable Stripe (card payments)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={paymentConfig.pickup_enabled}
              onChange={(e) => setPaymentConfig((p) => ({ ...p, pickup_enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-owner-action"
            />
            <span className="text-owner-charcoal">Enable Pay on Pickup</span>
          </label>
          <button type="submit" disabled={saving} className={btnPrimaryClass}>
            {saving ? "Saving..." : "Save payment gateways"}
          </button>
        </form>
      </section>

      <section id="opening-hours" className={sectionClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg md:text-base font-semibold text-owner-charcoal">
            Opening hours
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-owner-muted">Copy from:</span>
            <select
              id="copy-from-day"
              className="rounded-lg border border-owner-border bg-owner-card px-2 py-1.5 text-sm text-owner-charcoal"
              defaultValue="monday"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const fromDay = document.getElementById("copy-from-day")?.value || "monday";
                copyDayToAll(fromDay);
              }}
              className="rounded-lg bg-owner-action px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Copy to all days
            </button>
          </div>
        </div>
        <p className="mb-4 text-sm text-owner-muted">
          Set open and close times per day. Add multiple slots for split hours (e.g. lunch and dinner).
        </p>
        <form onSubmit={handleSaveSlots} className="space-y-4">
          <div className="space-y-4">
            {DAYS.map((day) => (
              <div key={day} className="rounded-lg border border-owner-border owner-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium capitalize text-owner-charcoal">{day}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSlotsByDay((s) => ({
                        ...s,
                        [day]: [...(s[day] || []), { open_time: "09:00:00", close_time: "17:00:00" }],
                      }))
                    }
                    className="text-sm text-owner-muted hover:text-owner-charcoal"
                  >
                    + Add slot
                  </button>
                </div>
                {(slotsByDay[day]?.length || 0) > 0 ? (
                  <div className="space-y-2">
                    {(slotsByDay[day] || []).map((slot, idx) => {
                      const openVal = (slot.open_time || "09:00:00").length === 5 ? `${slot.open_time}:00` : (slot.open_time || "09:00:00");
                      const closeVal = (slot.close_time || "17:00:00").length === 5 ? `${slot.close_time}:00` : (slot.close_time || "17:00:00");
                      return (
                        <div key={idx} className="flex flex-wrap items-center gap-2">
                          <select
                            value={openVal}
                            onChange={(e) =>
                              setSlotsByDay((s) => ({
                                ...s,
                                [day]: (s[day] || []).map((sl, i) =>
                                  i === idx ? { ...sl, open_time: e.target.value } : sl
                                ),
                              }))
                            }
                            className={`rounded-lg border border-owner-border bg-owner-card px-2 py-1.5 text-sm text-owner-charcoal ${timeInputClass}`}
                          >
                            {generateTimeOptions().map((t) => (
                              <option key={t} value={t}>{t.slice(0, 5)}</option>
                            ))}
                          </select>
                          <span className="text-owner-muted">–</span>
                          <select
                            value={closeVal}
                            onChange={(e) =>
                              setSlotsByDay((s) => ({
                                ...s,
                                [day]: (s[day] || []).map((sl, i) =>
                                  i === idx ? { ...sl, close_time: e.target.value } : sl
                                ),
                              }))
                            }
                            className={`rounded-lg border border-owner-border bg-owner-card px-2 py-1.5 text-sm text-owner-charcoal ${timeInputClass}`}
                          >
                            {generateTimeOptions().map((t) => (
                              <option key={t} value={t}>{t.slice(0, 5)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setSlotsByDay((s) => ({
                                ...s,
                                [day]: (s[day] || []).filter((_, i) => i !== idx),
                              }))
                            }
                            className="text-sm text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-owner-muted">Closed</p>
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={saving} className={btnPrimaryClass}>
            {saving ? "Saving..." : "Save opening hours"}
          </button>
        </form>
      </section>

      <section id="device" className={sectionClass}>
        <h3 className="mb-4 text-lg md:text-base font-semibold text-owner-charcoal">
          Device
        </h3>
        <p className="mb-4 text-sm text-owner-muted">
          When using the dashboard on a phone or tablet, you can keep the screen on so it does not dim or lock while the dashboard is open. Supported in Chrome and other modern mobile browsers.
        </p>
        {typeof onKeepScreenOnChange === "function" && (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={keepScreenOn}
              onChange={(e) => {
                const enabled = e.target.checked;
                setKeepScreenOnPreference(enabled);
                onKeepScreenOnChange(enabled);
              }}
              className="h-5 w-5 rounded border-owner-border text-owner-action focus:ring-owner-action"
            />
            <span className="text-sm font-medium text-owner-charcoal">
              Keep screen on when dashboard is open
            </span>
          </label>
        )}
      </section>
      </div>
    </div>
  );
}
