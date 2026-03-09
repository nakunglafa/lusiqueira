"use client";

/**
 * Centralized notification stack container.
 * - Desktop: bottom-right (like social sites).
 * - Mobile: bottom with margin (not flush to screen edge).
 * Use for live events (orders, reservations) and app toasts.
 */
export function NotificationStack({ children, className = "", ...props }) {
  return (
    <div
      className={[
        "fixed z-[100] flex flex-col gap-2",
        "bottom-6 right-6 left-auto max-w-[420px]",
        "max-sm:left-4 max-sm:right-4 max-sm:bottom-6 max-sm:max-w-none",
        "max-sm:pb-[env(safe-area-inset-bottom)]",
        className,
      ].filter(Boolean).join(" ")}
      aria-live="polite"
      {...props}
    >
      {children}
    </div>
  );
}
