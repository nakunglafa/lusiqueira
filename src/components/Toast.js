"use client";

import { useEffect } from "react";

/**
 * Bottom-right toast notification.
 * @param {{ message: string | null; type?: 'error' | 'success' | 'info'; onClose: () => void; duration?: number }} props
 */
export function Toast({ message, type = "error", onClose, duration = 6000 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const styles = {
    error: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/90",
    success: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/90",
    info: "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
  };

  const iconStyles = {
    error: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
    info: "text-zinc-600 dark:text-zinc-400",
  };

  return (
    <div
      className={`fixed z-50 max-w-sm rounded-xl border p-4 shadow-lg bottom-6 right-6 left-auto max-sm:left-4 max-sm:right-4 max-sm:bottom-6 max-sm:pb-[env(safe-area-inset-bottom)] ${styles[type]}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <svg
          className={`mt-0.5 h-5 w-5 shrink-0 ${iconStyles[type]}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {type === "error" ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${type === "error" ? "text-red-800 dark:text-red-200" : type === "success" ? "text-emerald-800 dark:text-emerald-200" : "text-zinc-800 dark:text-zinc-200"}`}>
            {message}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs font-medium underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
