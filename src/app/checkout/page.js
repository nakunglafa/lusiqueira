"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import {
  getRestaurantPaymentOptions,
  createOrder,
  createPaymentIntent,
} from "@/lib/api";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "9";
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

function formatPrice(value) {
  if (value == null || value === "") return "$0.00";
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function StripePaymentForm({ clientSecret, customerEmail, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setSubmitting(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${typeof window !== "undefined" ? window.location.origin : ""}/orders`,
          receipt_email: customerEmail || undefined,
        },
        redirect: "if_required",
      });
      if (error) {
        onError?.(error.message);
        return;
      }
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      const transactionId = paymentIntent?.id;
      if (transactionId) {
        onSuccess?.(transactionId);
      } else {
        onError?.("Could not retrieve payment confirmation.");
      }
    } catch (err) {
      onError?.(err?.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded-xl bg-zinc-900 py-3 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {submitting ? "Processing…" : "Pay with Card"}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const { token, user, isAuthenticated, loading: authLoading } = useAuth();
  const { items, totalAmount, clearCart, hydrate } = useCart();
  const [paymentOptions, setPaymentOptions] = useState({ stripe: true, pickup: true });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (STRIPE_PK) {
      setStripePromise(loadStripe(STRIPE_PK));
    }
  }, []);

  useEffect(() => {
    getRestaurantPaymentOptions(RESTAURANT_ID)
      .then((opts) => {
        setPaymentOptions({
          stripe: opts?.stripe ?? true,
          pickup: opts?.pickup ?? true,
        });
      })
      .catch(() => setPaymentOptions({ stripe: true, pickup: true }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      setCustomerName(user.name ?? "");
      setCustomerEmail(user.email ?? "");
    }
  }, [user]);

  const availableMethods = [];
  if (paymentOptions.stripe && STRIPE_PK) availableMethods.push({ id: "online_payment", label: "Pay with Card (Stripe)" });
  if (paymentOptions.pickup) availableMethods.push({ id: "cash_on_delivery", label: "Pay on Pickup" });

  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.find((m) => m.id === paymentMethod)) {
      setPaymentMethod(availableMethods[0].id);
    }
  }, [availableMethods.length, paymentMethod]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <p className="text-center text-zinc-500">Loading…</p>
        </main>
      </div>
    );
  }

  // Guests can checkout; they must provide name and at least one of email or phone below.

  if (items.length === 0 && !success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <p className="text-center text-zinc-600 dark:text-zinc-400">
            Your cart is empty. <Link href="/menu" className="text-amber-600 hover:underline">Browse menu</Link>
          </p>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
            <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">Order placed!</h2>
            <p className="mt-2 text-emerald-700 dark:text-emerald-300">
              {paymentMethod === "cash_on_delivery"
                ? "Pay when you pick up your order."
                : "Your payment has been processed."}
            </p>
            {!isAuthenticated && (
              <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
                To track this order later, <Link href="/login" className="font-medium underline hover:no-underline">log in</Link> with the same email.
              </p>
            )}
            <Link
              href="/menu"
              className="mt-6 inline-block rounded-xl bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-600"
            >
              Back to Menu
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const orderItems = items.map(({ item, quantity }) => ({
    menu_item_id: item.id,
    quantity,
  }));

  function validateGuestContact() {
    const nameOk = (customerName || "").trim().length > 0;
    const hasEmail = (customerEmail || "").trim().length > 0;
    const hasPhone = (customerPhone || "").trim().length > 0;
    if (!nameOk) {
      setError("Please enter your name.");
      return false;
    }
    if (!isAuthenticated && !hasEmail && !hasPhone) {
      setError("As a guest, please provide at least your email or phone number.");
      return false;
    }
    return true;
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    setError("");
    if (!validateGuestContact()) return;
    setSubmitting(true);
    try {
      const authToken = token || undefined;
      if (paymentMethod === "online_payment") {
        const piRes = await createPaymentIntent(authToken, {
          restaurant_id: Number(RESTAURANT_ID),
          items: orderItems,
        });
        const secret = piRes?.clientSecret ?? piRes?.client_secret ?? piRes?.data?.clientSecret ?? piRes?.data?.client_secret;
        if (secret) {
          setClientSecret(secret);
          return;
        }
        setError("Could not initialize payment. Try Pay on Pickup instead.");
        return;
      }

      await createOrder(authToken, {
        restaurant_id: Number(RESTAURANT_ID),
        order_type: "pickup",
        items: orderItems,
        payment_method: "cash_on_delivery",
        payment_status: "pending",
        customer_name: (customerName || "").trim(),
        customer_email: (customerEmail || "").trim() || undefined,
        customer_phone: (customerPhone || "").trim() || undefined,
        delivery_instructions: (notes || "").trim() || undefined,
      });
      clearCart();
      setSuccess(true);
    } catch (err) {
      setError(
        err?.data?.message ||
          (err?.data?.errors ? Object.values(err.data.errors).flat().join(" ") : null) ||
          err?.message ||
          "Failed to place order"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (clientSecret && stripePromise) {
    const options = { clientSecret, appearance: { theme: "stripe" } };
    const onlineOrderPayload = {
      restaurant_id: Number(RESTAURANT_ID),
      order_type: "pickup",
      items: orderItems,
      payment_method: "online_payment",
      payment_status: "paid",
      customer_name: (customerName || "").trim(),
      customer_email: (customerEmail || "").trim() || undefined,
      customer_phone: (customerPhone || "").trim() || undefined,
      delivery_instructions: (notes || "").trim() || undefined,
    };
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Complete Payment</h1>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-4 text-zinc-600 dark:text-zinc-400">Total: {formatPrice(totalAmount)}</p>
            <Elements stripe={stripePromise} options={options}>
              <StripePaymentForm
                clientSecret={clientSecret}
                customerEmail={customerEmail}
                onSuccess={async (transactionId) => {
                  try {
                    await createOrder(token || undefined, {
                      ...onlineOrderPayload,
                      transaction_id: transactionId,
                    });
                    clearCart();
                    setSuccess(true);
                  } catch (err) {
                    setError(
                      err?.data?.message ||
                        (err?.data?.errors ? Object.values(err.data.errors).flat().join(" ") : null) ||
                        err?.message ||
                        "Order could not be created. Please contact support."
                    );
                  }
                }}
                onError={setError}
              />
            </Elements>
            {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Checkout</h1>

        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Order summary</h2>
          <ul className="space-y-2">
            {items.map(({ item, quantity }) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {item.name} × {quantity}
                </span>
                <span>{formatPrice((parseFloat(item.price) || 0) * quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-zinc-200 pt-4 text-lg font-semibold dark:border-zinc-700 dark:text-zinc-100">
            Total: {formatPrice(totalAmount)}
          </p>
        </div>

        <form onSubmit={handlePlaceOrder} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Payment method
            </label>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Select how you would like to pay. Sent to the restaurant backend.
            </p>
            <div className="flex flex-col gap-2">
              {availableMethods.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value={m.id}
                    checked={paymentMethod === m.id}
                    onChange={() => setPaymentMethod(m.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-zinc-900 dark:text-zinc-100">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {!isAuthenticated && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Checking out as guest: please enter your name and at least one of email or phone.
              {" "}
              <span className="text-amber-700 dark:text-amber-300">To track your order later, <Link href="/login" className="font-medium underline hover:no-underline">log in</Link> before or after placing it.</span>
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name *</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email {!isAuthenticated ? "(required if no phone)" : ""}
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Phone {!isAuthenticated ? "(required if no email)" : ""}
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="Special requests, allergies, etc."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-zinc-900 py-4 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "Placing order…" : `Place order · ${formatPrice(totalAmount)}`}
          </button>
        </form>
      </main>
    </div>
  );
}
