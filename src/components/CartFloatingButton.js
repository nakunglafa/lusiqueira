"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

function formatPrice(value) {
  if (value == null || value === "") return "$0.00";
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function CartFloatingButton() {
  const { items, totalItems, totalAmount } = useCart();

  if (totalItems === 0) return null;

  return (
    <Link
      href="/checkout"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-xl bg-accent px-5 py-3 font-medium text-wood-950 shadow-lg transition hover:bg-accent-hover md:bottom-8 md:right-8"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0)" }}
      aria-label={`Proceed to checkout with ${totalItems} items`}
    >
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span>
        Proceed to Cart ({totalItems}) · {formatPrice(totalAmount)}
      </span>
    </Link>
  );
}
