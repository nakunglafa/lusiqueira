"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

const DRAWER_TRANSITION_MS = 300;

function formatPrice(value) {
  if (value == null || value === "") return "$0.00";
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function CartDrawer({ open, onClose }) {
  const { items, totalItems, totalAmount, removeItem, updateQuantity, hydrate } = useCart();
  const [isExiting, setIsExiting] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (open) setIsExiting(false);
  }, [open]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClose() {
    if (!open) return;
    setIsExiting(true);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onClose();
    }, DRAWER_TRANSITION_MS);
  }

  const visible = open || isExiting;
  const slideIn = open && !isExiting;

  if (!visible) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-100 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          slideIn ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={`fixed top-0 z-101 flex h-full w-full max-w-md flex-col bg-wood-200 border-l border-white/20 shadow-2xl text-wood-900 transition-transform duration-300 ease-out ${
          slideIn ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          right: 0,
          minHeight: "100dvh",
          height: "100%",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/20 bg-wood-100/80 px-4 py-4">
          <h2 id="cart-title" className="text-lg font-semibold text-wood-900">Your Cart ({totalItems})</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-wood-600 hover:bg-white/10 hover:text-wood-900 transition-colors"
            aria-label="Close cart"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 bg-wood-200/95">
          {items.length === 0 ? (
            <p className="py-8 text-center text-wood-600">Your cart is empty.</p>
          ) : (
            <ul className="space-y-4">
              {items.map(({ item, quantity }) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-wood-400/30 bg-wood-100/60 p-3"
                >
                  {item.image_url && (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-wood-300/50">
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-wood-900">{item.name}</p>
                    <p className="text-sm text-wood-600">
                      {formatPrice(item.price)} × {quantity}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, Math.max(0, quantity - 1))}
                        className="h-8 w-8 rounded border border-wood-500/40 text-wood-700 hover:bg-white/10 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm text-wood-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, quantity + 1)}
                        className="h-8 w-8 rounded border border-wood-500/40 text-wood-700 hover:bg-white/10 transition-colors"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="ml-2 text-sm text-red-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <div className="shrink-0 border-t border-white/20 bg-wood-100/80 p-4">
            <div className="mb-4 flex justify-between text-lg font-semibold text-wood-900">
              <span>Total</span>
              <span>{formatPrice(totalAmount)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={handleClose}
              className="block w-full rounded-xl bg-accent py-3 text-center font-medium text-wood-950 hover:bg-accent-hover transition-colors"
            >
              Proceed to Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
