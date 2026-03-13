"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AuthProvider } from "@/context/AuthContext";
import { isOwner } from "@/lib/owner-utils";
import { OwnerRefreshProvider } from "@/context/OwnerRefreshContext";
import { EVENTS } from "@/context/RealTimeNotificationContext";

function OwnerLayoutInner({ children }) {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/owner/dashboard");
      return;
    }
    if (!isOwner(user)) {
      router.replace("/");
    }
  }, [user, isAuthenticated, loading, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !isOwner(user)) return;

    const handleNewReservation = () => {};
    const handleReservationUpdated = () => {};
    const handleNewOrder = () => {};

    window.addEventListener(EVENTS.NEW_RESERVATION, handleNewReservation);
    window.addEventListener(EVENTS.RESERVATION_UPDATED, handleReservationUpdated);
    window.addEventListener(EVENTS.NEW_ORDER, handleNewOrder);

    return () => {
      window.removeEventListener(EVENTS.NEW_RESERVATION, handleNewReservation);
      window.removeEventListener(EVENTS.RESERVATION_UPDATED, handleReservationUpdated);
      window.removeEventListener(EVENTS.NEW_ORDER, handleNewOrder);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="owner-theme flex min-h-screen items-center justify-center">
        <p className="text-owner-charcoal">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isOwner(user)) {
    return null;
  }

  return (
    <OwnerRefreshProvider>
      <div className="owner-theme min-h-screen">
        <header className="border-b border-owner-walnut/20 bg-owner-walnut">
          <div className="mx-auto flex min-h-[56px] max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link
              href="/owner/dashboard"
              className="touch-manipulation min-h-[44px] inline-flex items-center gap-2 text-lg md:text-base font-semibold text-owner-nav"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-owner-nav">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Owner Dashboard
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="touch-manipulation min-h-[44px] hidden sm:inline-flex items-center rounded-lg px-4 py-2.5 text-base md:text-sm font-medium text-owner-nav hover:bg-white/10 transition-colors"
            >
                Back to site
              </Link>

              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 rounded-full border border-owner-nav/30 bg-owner-walnut p-1 pr-2 sm:pr-3 text-sm font-medium text-owner-nav shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-owner-action focus:ring-offset-2 focus:ring-offset-owner-walnut transition-colors"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-owner-success/90 text-owner-nav font-bold">
                    {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'O'}
                  </div>
                  <span className="hidden sm:block max-w-[120px] truncate">{user?.name || user?.email}</span>
                  <svg className="h-4 w-4 text-owner-nav" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-owner-card shadow-owner-card ring-1 ring-owner-border z-50">
                    <div className="px-4 py-3 border-b border-owner-border">
                      <p className="text-sm text-owner-muted">Signed in as</p>
                      <p className="truncate text-sm font-medium text-owner-charcoal">{user?.email}</p>
                      {user?.name && <p className="truncate text-xs text-owner-muted mt-0.5">{user.name}</p>}
                    </div>
                    <div className="py-1">
                      <Link
                        href="/"
                        className="block sm:hidden px-4 py-2 text-sm text-owner-charcoal hover:bg-owner-paper"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Back to site
                      </Link>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          logout();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </OwnerRefreshProvider>
  );
}

export default function OwnerLayout({ children }) {
  return (
    <AuthProvider>
      <OwnerLayoutInner>{children}</OwnerLayoutInner>
    </AuthProvider>
  );
}
