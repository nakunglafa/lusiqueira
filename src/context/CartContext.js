"use client";

import { createContext, useContext, useReducer, useState, useCallback, useEffect } from "react";

const CART_KEY = "restaurant_cart";

function loadCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (_) {}
}

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const { item, quantity = 1 } = action.payload;
      const existing = state.find((i) => i.item.id === item.id);
      let next;
      if (existing) {
        next = state.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      } else {
        next = [...state, { item, quantity }];
      }
      saveCart(next);
      return next;
    }
    case "REMOVE": {
      const next = state.filter((i) => i.item.id !== action.payload.itemId);
      saveCart(next);
      return next;
    }
    case "UPDATE_QTY": {
      const { itemId, quantity } = action.payload;
      if (quantity <= 0) {
        const next = state.filter((i) => i.item.id !== itemId);
        saveCart(next);
        return next;
      }
      const next = state.map((i) =>
        i.item.id === itemId ? { ...i, quantity } : i
      );
      saveCart(next);
      return next;
    }
    case "CLEAR":
      saveCart([]);
      return [];
    case "HYDRATE":
      return action.payload ?? [];
    default:
      return state;
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const [hydrated, setHydrated] = useState(false);

  const hydrate = useCallback(() => {
    dispatch({ type: "HYDRATE", payload: loadCart() });
  }, []);

  const addItem = useCallback((item, quantity = 1) => {
    dispatch({ type: "ADD", payload: { item, quantity } });
  }, []);

  const removeItem = useCallback((itemId) => {
    dispatch({ type: "REMOVE", payload: { itemId } });
  }, []);

  const updateQuantity = useCallback((itemId, quantity) => {
    dispatch({ type: "UPDATE_QTY", payload: { itemId, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce(
    (sum, i) => sum + (parseFloat(i.item.price) || 0) * i.quantity,
    0
  );

  const value = {
    items,
    totalItems,
    totalAmount,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    hydrate,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
