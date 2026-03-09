"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getMyRestaurants,
  getRestaurantById,
  getRestaurantOrders,
  getRestaurantTables,
  getOwnerRestaurantReservations,
  getMenusForRestaurant,
} from "@/lib/api";
import { toArray } from "@/lib/owner-utils";
import { useOwnerRefresh } from "@/context/OwnerRefreshContext";
import { useScreenWakeLock, getKeepScreenOnPreference } from "@/hooks/useScreenWakeLock";
import { OrdersTab } from "@/components/owner/OrdersTab";
import { MenuTab } from "@/components/owner/MenuTab";
import { TablesTab } from "@/components/owner/TablesTab";
import { ReservationsTab } from "@/components/owner/ReservationsTab";
import { SettingsTab } from "@/components/owner/SettingsTab";

const iconClass = "text-owner-success";
const iconSize = 18;

const TABS = [
  {
    id: "orders",
    label: "Orders",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: "menu",
    label: "Menu",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    ),
  },
  {
    id: "tables",
    label: "Tables",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <path d="M4 4h16v16H4z" />
        <path d="M4 12h16" />
        <path d="M12 4v16" />
      </svg>
    ),
  },
  {
    id: "reservations",
    label: "Reservations",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function OwnerDashboardRestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = params.restaurantId;
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [menus, setMenus] = useState([]);
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Track if we've already fetched to avoid infinite loops
  const [hasLoaded, setHasLoaded] = useState(false);
  // Keep screen on when dashboard is open (mobile); preference from Settings
  const [keepScreenOn, setKeepScreenOn] = useState(false);

  const { registerRefresh } = useOwnerRefresh();

  // Apply screen wake lock when dashboard is open on mobile (Chrome etc.), if enabled in settings
  useScreenWakeLock(keepScreenOn);

  // Initialize keepScreenOn from localStorage after mount (client-only)
  useEffect(() => {
    setKeepScreenOn(getKeepScreenOnPreference());
  }, []);

  const loadData = useCallback(() => {
    if (!restaurantId || !token) return;
    setError("");
    setLoading(true);
    Promise.all([
      getMyRestaurants(token),
      getRestaurantById(restaurantId, token, true).catch(() => null),
      getRestaurantOrders(token, restaurantId),
      getRestaurantTables(token, restaurantId),
      getOwnerRestaurantReservations(token, restaurantId),
      getMenusForRestaurant(token, restaurantId),
    ])
      .then(([restRes, restDetailRes, oRes, tRes, rRes, mRes]) => {
        const restList = toArray(restRes);
        setRestaurants(restList);
        const restDetail = restDetailRes?.data ?? restDetailRes ?? restList.find((r) => String(r.id) === String(restaurantId));
        setRestaurant(restDetail || restList.find((r) => String(r.id) === String(restaurantId)));
        setOrders(toArray(oRes));
        setTables(toArray(tRes));
        setReservations(toArray(rRes));
        setMenus(toArray(mRes));
      })
      .catch((err) => {
        setError(err?.message || err?.data?.message || "Failed to load dashboard");
      })
      .finally(() => {
        setLoading(false);
        setHasLoaded(true);
      });
  }, [restaurantId, token]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      router.push("/login?redirect=/owner/dashboard");
      return;
    }
    if (!token || hasLoaded) return;
    
    // Use a small delay/timeout to avoid firing immediately on every re-render and rate-limiting the backend
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [restaurantId, token, isAuthenticated, authLoading, router, loadData, hasLoaded]);

  useEffect(() => {
    // We only need to register the refresh context once per mount
    const unregister = registerRefresh(loadData);
    return () => {
      if (typeof unregister === 'function') unregister();
    };
  }, [registerRefresh, loadData]);

  const handleRestaurantChange = (e) => {
    const id = e.target.value;
    if (id) router.push(`/owner/dashboard/${id}`);
  };

  if (authLoading) return null;
  if (!isAuthenticated) return null;
  if (loading && !restaurant) {
    return (
      <div className="owner-theme-bg flex min-h-screen items-center justify-center">
        <p className="text-owner-charcoal">Loading dashboard...</p>
      </div>
    );
  }
  if (!restaurant && restaurants.length > 0) {
    router.replace(`/owner/dashboard/${restaurants[0].id}`);
    return null;
  }
  if (!restaurant && !loading) {
    return (
      <div className="owner-theme-bg flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-owner-charcoal">Restaurant not found.</p>
        <Link
          href="/owner/dashboard"
          className="touch-manipulation min-h-[48px] inline-flex items-center justify-center rounded-xl bg-owner-action px-6 py-4 text-base font-medium text-white hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const tabButtonBase = "touch-manipulation inline-flex items-center justify-center transition-colors active:scale-[0.98]";
  const tabButtonActive = "bg-owner-action text-white shadow";
  const tabButtonInactive = "text-owner-nav hover:bg-white/10";

  return (
    <div className="owner-theme-bg min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-owner-walnut/20 bg-owner-walnut/95 backdrop-blur text-owner-nav">
        <div
          className={`mx-auto flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
            activeTab === "menu" ? "max-w-7xl xl:max-w-[90rem]" : "max-w-6xl"
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/owner/dashboard"
              className="touch-manipulation min-h-[48px] inline-flex items-center gap-2 rounded-lg px-4 py-3 text-base md:text-sm font-medium text-owner-nav hover:bg-white/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-owner-nav">
                <path d="M19 12H5" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Dashboard
            </Link>
            <h1 className="text-xl md:text-lg font-bold text-owner-nav sm:text-xl">
              {restaurant?.name ?? `Restaurant #${restaurantId}`}
            </h1>
          </div>
          {restaurants.length > 1 && (
            <select
              value={restaurantId}
              onChange={handleRestaurantChange}
              className="touch-manipulation min-h-[48px] w-full rounded-xl border border-owner-nav/30 bg-owner-walnut px-4 py-3 text-base md:text-sm text-owner-nav sm:w-auto sm:rounded-lg sm:py-2 sm:text-sm"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id} className="bg-owner-card text-owner-charcoal">
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {/* Desktop: icon + bold label in same row */}
        <nav className={`hidden md:flex md:gap-2 md:overflow-x-auto md:pb-2 mx-auto px-4 ${
          activeTab === "menu" ? "max-w-7xl xl:max-w-[90rem]" : "max-w-6xl"
        }`}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`${tabButtonBase} min-h-[44px] flex-1 min-w-0 shrink-0 flex-row gap-2 rounded-lg px-4 py-2.5 text-sm md:text-xs font-bold ${
                activeTab === tab.id ? tabButtonActive : tabButtonInactive
              }`}
            >
              <span className="shrink-0">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Mobile: fixed bottom bar, icons only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-owner-walnut/20 bg-owner-walnut/95 py-2 pb-[env(safe-area-inset-bottom)] backdrop-blur text-owner-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`${tabButtonBase} flex-1 min-w-0 py-3 ${
              activeTab === tab.id ? tabButtonActive : tabButtonInactive
            }`}
            aria-label={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </nav>

      <main
        className={`mx-auto px-4 py-6 pb-8 sm:pb-6 ${
          activeTab === "menu" ? "max-w-7xl xl:max-w-[90rem]" : "max-w-6xl"
        }`}
      >
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-600">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="touch-manipulation mt-2 min-h-[48px] rounded-lg bg-red-100 px-4 py-3 text-base md:text-sm font-medium text-red-700"
            >
              Try again
            </button>
          </div>
        )}
        {activeTab === "orders" && (
          <OrdersTab
            orders={orders}
            restaurantId={restaurantId}
            token={token}
            onRefresh={loadData}
          />
        )}
        {activeTab === "menu" && (
          <MenuTab
            menus={menus}
            restaurantId={restaurantId}
            token={token}
            onRefresh={loadData}
          />
        )}
        {activeTab === "tables" && (
          <TablesTab
            tables={tables}
            restaurantId={restaurantId}
            token={token}
            onRefresh={loadData}
          />
        )}
        {activeTab === "reservations" && (
          <ReservationsTab
            reservations={reservations}
            restaurantId={restaurantId}
            token={token}
            onRefresh={loadData}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            restaurant={restaurant}
            restaurantId={restaurantId}
            token={token}
            onRefresh={loadData}
            onRestaurantUpdate={(updated) => {
              if (updated && typeof updated === "object") {
                setRestaurant((prev) => (prev ? { ...prev, ...updated } : updated));
              }
            }}
            keepScreenOn={keepScreenOn}
            onKeepScreenOnChange={setKeepScreenOn}
          />
        )}
      </main>

      {/* Mobile: fixed bottom bar, icons only (spacer duplicate) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-owner-walnut/20 bg-owner-walnut/95 py-2 pb-[env(safe-area-inset-bottom)] backdrop-blur text-owner-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`${tabButtonBase} flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
              activeTab === tab.id ? tabButtonActive : tabButtonInactive
            }`}
            aria-label={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </nav>
    </div>
  );
}
