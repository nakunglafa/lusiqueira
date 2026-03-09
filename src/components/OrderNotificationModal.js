"use client";

import { useEffect, useRef, useCallback } from "react";

const PENDING_STATUSES = ["pending", "pending_confirmation", "new"];

function isOrderPending(order) {
  const s = (order?.status || "").toLowerCase();
  return PENDING_STATUSES.some((p) => s.includes(p) || p.includes(s));
}

function playNotificationBeep() {
  if (typeof window === "undefined") return null;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playBeep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    };
    return playBeep;
  } catch {
    return null;
  }
}

export function OrderNotificationModal({ orders, onDismiss, visible }) {
  const intervalRef = useRef(null);
  const playBeepRef = useRef(null);

  const hasPendingOrders = Array.isArray(orders) && orders.some(isOrderPending);

  const stopAudio = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible || !hasPendingOrders) {
      stopAudio();
      return;
    }
    playBeepRef.current = playNotificationBeep();
    if (playBeepRef.current) {
      playBeepRef.current();
      intervalRef.current = setInterval(() => {
        if (playBeepRef.current) playBeepRef.current();
      }, 3000);
    }
    return stopAudio;
  }, [visible, hasPendingOrders, stopAudio]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!visible || !hasPendingOrders) return null;

  const pendingCount = orders.filter(isOrderPending).length;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-200 bg-white p-6 shadow-xl dark:border-amber-800 dark:bg-zinc-900"
        role="alertdialog"
        aria-labelledby="order-notification-title"
        aria-describedby="order-notification-desc"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <svg
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="order-notification-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Order waiting for confirmation
            </h2>
            <p
              id="order-notification-desc"
              className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
            >
              {pendingCount === 1
                ? "Your order is pending. The restaurant will confirm it shortly. You'll hear a sound until it's accepted."
                : `${pendingCount} orders are pending. The restaurant will confirm them shortly. You'll hear a sound until they're accepted.`}
            </p>
            <button
              type="button"
              onClick={() => {
                stopAudio();
                onDismiss?.();
              }}
              className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              Dismiss (stop sound)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
