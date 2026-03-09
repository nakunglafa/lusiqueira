"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { getRestaurant } from "@/lib/api";
import { isOwner } from "@/lib/owner-utils";
import { CartDrawer } from "@/components/CartDrawer";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "9";

export function Header() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const { totalItems, hydrate } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);
  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [resLoading, setResLoading] = useState(true);

  useEffect(() => {
    getRestaurant(RESTAURANT_ID)
      .then((data) => {
        if (data?.restaurant?.name) {
          setRestaurantName(data.restaurant.name);
        }
      })
      .catch(() => {})
      .finally(() => setResLoading(false));
  }, []);

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-wood-100/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-semibold text-wood-900 flex items-center gap-2"
          onClick={closeMenu}
        >
          {resLoading ? (
            <div className="h-5 w-32 animate-pulse rounded-md bg-wood-400/50"></div>
          ) : (
            restaurantName
          )}
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-4 md:flex">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative rounded-lg p-2 text-wood-600 hover:bg-white/10 hover:text-wood-900 transition-colors"
            aria-label="Open cart"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-wood-950">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </button>
          <Link href="/menu" className="text-[15px] font-medium text-wood-600 hover:text-wood-900 transition-colors">
            Menu
          </Link>
          <Link href="/book" className="text-[15px] font-medium text-wood-600 hover:text-wood-900 transition-colors">
            Book a Table
          </Link>
          {loading ? (
            <span className="text-sm text-wood-600">...</span>
          ) : isAuthenticated ? (
            <>
              {isOwner(user) && (
                <Link href="/owner/dashboard" className="text-[15px] font-medium text-accent hover:text-accent-hover">
                  Owner Dashboard
                </Link>
              )}
              <Link href="/reservations" className="text-[15px] font-medium text-wood-600 hover:text-wood-900 transition-colors">
                My Reservations
              </Link>
              <Link href="/orders" className="text-[15px] font-medium text-wood-600 hover:text-wood-900 transition-colors">
                My Orders
              </Link>
              <Link href="/profile" className="text-[15px] font-medium text-wood-600 hover:text-wood-900 transition-colors">
                {user?.name || "Profile"}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-[15px] text-wood-600 hover:bg-white/10 hover:text-wood-900 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-[15px] text-wood-600 hover:bg-white/10 hover:text-wood-900 transition-colors">
                Login
              </Link>
              <Link href="/register" className="rounded-full bg-accent px-4 py-2.5 text-[15px] font-medium text-wood-950 hover:bg-accent-hover transition-colors shadow-md">
                Sign up
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          className="p-2 md:hidden text-wood-600 hover:text-wood-900 rounded-lg hover:bg-white/10 transition-colors"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-wood-200/95 backdrop-blur-xl px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                setCartOpen(true);
                closeMenu();
              }}
              className="flex w-full items-center gap-2 text-base font-medium text-wood-900"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Cart {totalItems > 0 && `(${totalItems})`}
            </button>
            <Link
              href="/menu"
              className="text-base font-medium text-wood-900 dark:text-wood-100"
              onClick={closeMenu}
            >
              Menu
            </Link>
            <Link
              href="/book"
              className="text-base font-medium text-wood-900 dark:text-wood-100"
              onClick={closeMenu}
            >
              Book a Table
            </Link>
            {loading ? (
              <span className="text-base text-wood-600">...</span>
            ) : isAuthenticated ? (
              <>
                {isOwner(user) && (
                  <Link
                    href="/owner/dashboard"
                    className="text-base font-medium text-accent hover:text-accent-hover dark:text-accent dark:hover:text-accent-hover"
                    onClick={closeMenu}
                  >
                    Owner Dashboard
                  </Link>
                )}
                <Link
                  href="/reservations"
                  className="text-base font-medium text-wood-600 hover:text-wood-900 dark:text-wood-600 dark:hover:text-wood-900"
                  onClick={closeMenu}
                >
                  My Reservations
                </Link>
                <Link
                  href="/orders"
                  className="text-base font-medium text-wood-600 hover:text-wood-900 dark:text-wood-600 dark:hover:text-wood-900"
                  onClick={closeMenu}
                >
                  My Orders
                </Link>
                <Link
                  href="/profile"
                  className="text-base font-medium text-wood-600 hover:text-wood-900 dark:text-wood-600 dark:hover:text-wood-900"
                  onClick={closeMenu}
                >
                  {user?.name || "Profile"}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="w-full text-left text-base font-medium text-wood-600 hover:text-wood-900"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <Link href="/login" className="text-base font-medium text-wood-900" onClick={closeMenu}>
                  Login
                </Link>
                <Link href="/register" className="text-base font-medium text-wood-900" onClick={closeMenu}>
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}
