"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { getRestaurant } from "@/lib/api";
import { useCart } from "@/context/CartContext";

const BANNER_SLIDES = [
  {
    id: "menu",
    image: "/hero/1.jpg",
    alt: "Burger",
    title: "Discover Our Menu",
    subtitle: "Fresh ingredients, crafted with care",
    cta: "View Menu",
    href: "/menu",
    primary: false,
  },
  {
    id: "book",
    image: "/hero/2.jpg",
    alt: "Steak",
    title: "Reserve Your Table",
    subtitle: "Dine with us — book now",
    cta: "Book a Table",
    href: "/book",
    primary: true,
  },
];

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "9";
const RESTAURANT_NAME_ENV = process.env.NEXT_PUBLIC_RESTAURANT_NAME || null;

function formatPrice(value) {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// Helper function to capitalize days and format times to 12-hour AM/PM format
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hoursStr, minutesStr] = timeStr.split(":");
  let hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  return `${hours}:${minutesStr} ${ampm}`;
}

function formatOpeningHoursSentence(openingHours) {
  if (!openingHours || openingHours.length === 0) return "Opening hours not available.";

  const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  
  const slotsByDay = {};
  daysOfWeek.forEach((day) => {
    slotsByDay[day] = [];
  });

  openingHours.forEach((slot) => {
    if (slotsByDay[slot.day_of_week]) {
      slotsByDay[slot.day_of_week].push(slot);
    }
  });

  const scheduleMap = {};
  daysOfWeek.forEach((day) => {
    const daySlots = slotsByDay[day];
    let timeStr = "Closed";
    if (daySlots.length > 0) {
      daySlots.sort((a, b) => a.open_time.localeCompare(b.open_time));
      // Join with ' and ' if multiple slots in a day
      timeStr = daySlots.map((s) => `${formatTime(s.open_time)} - ${formatTime(s.close_time)}`).join(" and ");
    }
    if (!scheduleMap[timeStr]) scheduleMap[timeStr] = [];
    scheduleMap[timeStr].push(day);
  });

  const uniqueSchedules = Object.keys(scheduleMap);
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  if (uniqueSchedules.length === 1) {
    if (uniqueSchedules[0] === "Closed") return "Closed every day.";
    return `Open every day from ${uniqueSchedules[0]}.`;
  }

  if (uniqueSchedules.length === 2 && uniqueSchedules.includes("Closed")) {
    const openSchedule = uniqueSchedules.find((s) => s !== "Closed");
    const closedDays = scheduleMap["Closed"];
    
    if (closedDays.length === 1) {
      return `Open every day from ${openSchedule} except ${capitalize(closedDays[0])} (Closed).`;
    } else if (closedDays.length === 2) {
      return `Open every day from ${openSchedule} except ${capitalize(closedDays[0])} and ${capitalize(closedDays[1])} (Closed).`;
    }
  }

  // Fallback for more complex schedules
  return Object.entries(scheduleMap)
    .filter(([timeStr]) => timeStr !== "Closed")
    .map(([timeStr, days]) => {
      const formattedDays = days.map(capitalize).join(", ");
      return `${formattedDays}: ${timeStr}`;
    })
    .join(" | ");
}

const AUTO_SLIDE_MS = 5000;

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const specialsRowRef = useRef(null);
  const specialMenusRowRefs = useRef([]);
  const { addItem } = useCart();
  const [activeSpecialId, setActiveSpecialId] = useState(null);
  const [activeSpecialMenuItemId, setActiveSpecialMenuItemId] = useState(null);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getRestaurant(RESTAURANT_ID)
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load restaurant info"))
      .finally(() => setLoading(false));
  }, []);

  const restaurant = data?.restaurant;
  // According to the new JSON structure, slots are inside data.opening_hours.opening_slots
  const openingHours = data?.opening_hours?.opening_slots || [];

  const specialItems = useMemo(() => {
    const lists =
      data?.special_menus ??
      restaurant?.special_menus ??
      [];
    if (!Array.isArray(lists)) return [];
    const seen = new Set();
    const items = [];
    lists.forEach((list) => {
      const arr = Array.isArray(list.items) ? list.items : [];
      arr.forEach((item) => {
        const id = item.id ?? item.menu_item_id;
        if (!id || seen.has(id)) return;
        seen.add(id);
        if (item.is_available === false) return;
        items.push(item);
      });
    });
    return items.slice(0, 12);
  }, [data, restaurant]);

  const specialMenuListsForUI = useMemo(() => {
    const lists =
      restaurant?.special_menu_lists ??
      data?.special_menu_lists ??
      [];
    if (!Array.isArray(lists)) return [];

    return lists
      .filter((l) => l && l.is_active !== false)
      .map((l) => {
        const items = Array.isArray(l.items) ? l.items : [];
        const filtered = items.filter((it) => it?.is_available !== false);
        return {
          id: l.id ?? l.slug ?? l.name,
          name: l.name ?? "Special",
          items: filtered,
        };
      })
      .filter((l) => l.items.length > 0);
  }, [data, restaurant]);

  // Auto-slide horizontal "Chef's specials" row
  useEffect(() => {
    if (!specialsRowRef.current || specialItems.length === 0) return;
    const row = specialsRowRef.current;
    const card = row.querySelector("article");
    if (!card) return;

    const cardWidth = card.getBoundingClientRect().width + 16; // include gap

    const interval = setInterval(() => {
      if (!row) return;
      const maxScroll = row.scrollWidth - row.clientWidth;
      const next = row.scrollLeft + cardWidth;
      row.scrollTo({
        left: next >= maxScroll ? 0 : next,
        behavior: "smooth",
      });
    }, AUTO_SLIDE_MS);

    return () => clearInterval(interval);
  }, [specialItems.length]);

  // Auto-slide all special menu rows
  useEffect(() => {
    const rows = (specialMenusRowRefs.current || []).filter(Boolean);
    if (rows.length === 0) return;

    const intervals = rows.map((row) => {
      const card = row.querySelector("article");
      if (!card) return null;
      const cardWidth = card.getBoundingClientRect().width + 16;

      return setInterval(() => {
        const maxScroll = row.scrollWidth - row.clientWidth;
        const next = row.scrollLeft + cardWidth;
        row.scrollTo({
          left: next >= maxScroll ? 0 : next,
          behavior: "smooth",
        });
      }, AUTO_SLIDE_MS);
    });

    return () => {
      intervals.forEach((id) => id && clearInterval(id));
    };
  }, [specialMenuListsForUI.length]);

  // Enable mouse-drag horizontal scrolling for specials rows (desktop)
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  const handleDragStart = (e) => {
    const el = e.currentTarget;
    isDraggingRef.current = true;
    dragStartXRef.current = e.pageX - el.offsetLeft;
    dragScrollLeftRef.current = el.scrollLeft;
  };

  const handleDragMove = (e) => {
    if (!isDraggingRef.current) return;
    const el = e.currentTarget;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = x - dragStartXRef.current;
    el.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      {/* Hero banner – fade between 2 slides: View Menu / Book Table, full width 80vh */}
      <section className="relative h-[80vh] w-full overflow-hidden bg-wood-200">
        {BANNER_SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-500 ease-out ${
              index === activeBanner ? "z-1 opacity-100" : "z-0 opacity-0 pointer-events-none"
            }`}
          >
            {/* Full-width background image with dark filter */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${slide.image})`,
                filter: "brightness(0.5) contrast(1.05) saturate(0.9)",
              }}
              aria-hidden
            />
            {/* Dark overlay so light text is readable */}
            <div
              className="absolute inset-0 bg-black/60"
              aria-hidden
            />
            <div className="relative z-10 max-w-xl">
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-wood-900 sm:text-3xl md:text-4xl">
                {slide.title}
              </h2>
              <p className="mb-6 text-wood-600 sm:text-lg">{slide.subtitle}</p>
              <Link
                href={slide.href}
                className={
                  slide.primary
                    ? "inline-flex rounded-full bg-accent px-8 py-3.5 text-[17px] font-medium text-wood-950 shadow-lg transition-colors hover:bg-accent-hover hover:shadow-xl"
                    : "inline-flex rounded-full border-2 border-wood-500/60 bg-white/10 px-8 py-3.5 text-[17px] font-medium text-wood-900 backdrop-blur-sm transition-colors hover:bg-white/20 hover:border-wood-500"
                }
              >
                {slide.cta}
              </Link>
            </div>
          </div>
        ))}
        {/* Dot indicators */}
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
          {BANNER_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveBanner(i)}
              className={`h-2.5 w-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-wood-500 focus:ring-offset-2 focus:ring-offset-wood-900/50 ${
                i === activeBanner ? "bg-accent scale-125" : "bg-wood-500/60 hover:bg-wood-500"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <section className="mb-10 md:mb-16">
          {loading ? (
            <div className="py-20 text-[17px] text-wood-600">Loading...</div>
          ) : error ? (
            <div className="py-20 text-[17px] text-red-400">{error}</div>
          ) : (
            <div className="rounded-3xl p-6 md:p-10 text-left max-w-4xl mx-auto shadow-2xl bg-transparent w-full outline-none focus:outline-none focus:ring-0">
              {restaurant?.logo_url && (
                <div className="mb-6 flex justify-center">
                  <img
                    src={restaurant.logo_url}
                    alt={`${restaurant.name} logo`}
                    className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover shadow-xl ring-2 ring-wood-500/50 ring-offset-2 ring-offset-transparent"
                  />
                </div>
              )}
              <h1 className="mb-4 text-3xl font-bold tracking-tight text-wood-900 sm:text-5xl">
                {RESTAURANT_NAME_ENV || restaurant?.name || "Our Restaurant"}
              </h1>
              {restaurant?.cuisine && (
                <p className="mx-auto mt-2 max-w-xl text-[17px] sm:text-lg font-medium text-wood-600">
                  {restaurant.cuisine}
                </p>
              )}
              {restaurant?.address && (
                <p className="mx-auto mt-2 max-w-xl text-[16px] sm:text-[17px] text-wood-600">
                  {restaurant.address}
                </p>
              )}
              {restaurant?.phone && (
                <p className="mx-auto mt-1 max-w-xl text-[16px] sm:text-[17px] text-wood-600">
                  {restaurant.phone}
                </p>
              )}
              {restaurant?.description && (
                <p className="mx-auto mt-6 max-w-2xl text-[17px] sm:text-lg leading-relaxed text-wood-700">
                  {restaurant.description}
                </p>
              )}
              <div className="mt-8">
                <div className="rounded-2xl border border-white/10 p-4 md:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-4 items-stretch">
                    <div className="h-full flex flex-col justify-center text-center sm:text-left">
                      <p className="text-sm font-medium text-wood-900">Contact</p>
                      <p className="mt-1 text-[15px] text-wood-600 wrap-break-word">
                        {restaurant?.address ? restaurant.address : ""}
                      </p>
                      {restaurant?.phone && (
                        <p className="mt-1 text-[15px] text-wood-600">{restaurant.phone}</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 h-full">
                      <Link
                        href="/menu"
                        className="flex-1 rounded-full border-2 border-wood-500/60 bg-transparent px-6 py-3 text-[16px] font-medium text-wood-900 hover:bg-white/10 hover:border-wood-500 transition-colors backdrop-blur-sm text-center focus:outline-none focus:ring-0"
                      >
                        View Menu
                      </Link>
                      <Link
                        href="/book"
                        className="flex-1 rounded-full bg-accent px-6 py-3 text-[16px] font-medium text-wood-950 hover:bg-accent-hover text-center transition-colors shadow-lg hover:shadow-xl focus:outline-none focus:ring-0"
                      >
                        Book a Table
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {!loading && !error && specialItems.length > 0 && (
          <section className="mb-12 md:mb-16">
            <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 px-4 sm:px-6 lg:px-8">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl md:text-3xl font-semibold text-wood-900">
                    Chef&apos;s specials
                  </h2>
                  <Link
                    href="/menu"
                    className="text-sm font-medium text-wood-700 hover:text-wood-900"
                  >
                    View full menu
                  </Link>
                </div>

                <p className="mb-4 text-sm text-wood-600">
                  A curated selection of highlighted dishes from the menu.
                </p>

                <div
                  ref={specialsRowRef}
                  className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide cursor-grab active:cursor-grabbing"
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseLeave={handleDragEnd}
                  onMouseUp={handleDragEnd}
                >
                  {specialItems.map((item) => {
                    const itemKey = item.id ?? item.menu_item_id;
                    const isActive = activeSpecialId === itemKey;
                    return (
                    <article
                      key={itemKey}
                      className="group relative w-56 shrink-0 rounded-2xl bg-white/5 shadow-sm hover:shadow-md transition-transform duration-200 hover:scale-105 overflow-hidden"
                      onClick={() =>
                        setActiveSpecialId((prev) => (prev === itemKey ? null : itemKey))
                      }
                    >
                      <div className="h-56 w-full overflow-hidden bg-black/5">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name ?? "Special item"}
                            className="h-full w-full object-cover transition duration-200 group-hover:blur-sm group-hover:brightness-75"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-wood-300/40 text-wood-700 text-sm font-semibold">
                            {item.name ?? "Special item"}
                          </div>
                        )}
                      </div>

                      <div className="px-3 py-3 space-y-1">
                        <h3 className="text-sm font-semibold text-wood-900 line-clamp-2">
                          {item.name}
                        </h3>
                        {item.price != null && item.price !== "" && (
                          <p className="text-sm font-semibold text-wood-900">
                            {formatPrice(item.price)}
                          </p>
                        )}
                      </div>

                      {item.description && (
                        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-all duration-200 ${
                          isActive ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                        }`}>
                          <div className="mx-1 mb-1 rounded-2xl bg-white text-wood-800 text-[11px] leading-snug p-3 shadow-xl backdrop-blur-md max-h-40 overflow-y-auto">
                            <p className="whitespace-pre-line">{item.description}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem(item, 1);
                              }}
                              className="mt-2 w-full rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-wood-950 hover:bg-accent-hover transition-colors pointer-events-auto"
                            >
                              Add to cart
                            </button>
                          </div>
                        </div>
                      )}
                      {!item.description && (
                        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-all duration-200 ${
                          isActive ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                        }`}>
                          <div className="mx-1 mb-1 rounded-2xl bg-white text-wood-800 text-[11px] leading-snug p-3 shadow-xl backdrop-blur-md">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem(item, 1);
                              }}
                              className="w-full rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-wood-950 hover:bg-accent-hover transition-colors pointer-events-auto"
                            >
                              Add to cart
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  )})}
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && !error && specialMenuListsForUI.length > 0 && (
          <section className="mb-12 md:mb-16">
            <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 px-4 sm:px-6 lg:px-8">
              <div className="max-w-6xl mx-auto">
                <div className="mb-6 text-center">
                  <h2 className="text-2xl md:text-3xl font-semibold text-wood-900">
                    Special menus
                  </h2>
                </div>

                <div className="space-y-10">
                  {specialMenuListsForUI.map((list) => (
                    <div key={String(list.id)} className="space-y-3">
                      <h3 className="text-lg md:text-xl font-semibold text-wood-900">
                        {list.name}
                      </h3>
                      <div
                        ref={(el) => {
                          if (el) {
                            specialMenusRowRefs.current[list.id] = el;
                          }
                        }}
                        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide cursor-grab active:cursor-grabbing"
                        onMouseDown={handleDragStart}
                        onMouseMove={handleDragMove}
                        onMouseLeave={handleDragEnd}
                        onMouseUp={handleDragEnd}
                      >
                        {list.items.map((item) => {
                          const itemKey = item.id ?? item.menu_category_id ?? item.name;
                          const isActive = activeSpecialMenuItemId === itemKey;
                          return (
                          <article
                            key={itemKey}
                            className="group relative w-56 shrink-0 rounded-2xl bg-white/5 border border-white/10 shadow-sm hover:shadow-md transition-transform duration-200 hover:scale-105 overflow-hidden"
                            onClick={() =>
                              setActiveSpecialMenuItemId((prev) => (prev === itemKey ? null : itemKey))
                            }
                          >
                            <div className="h-48 w-full overflow-hidden bg-black/5">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name ?? "Special item"}
                                  className="h-full w-full object-cover transition duration-200 group-hover:blur-sm group-hover:brightness-75"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-wood-300/40 text-wood-700 text-sm font-semibold">
                                  {item.name ? item.name.slice(0, 18) : "Special item"}
                                </div>
                              )}
                            </div>
                            <div className="px-3 py-3 space-y-1">
                              <h4 className="text-sm font-semibold text-wood-900 line-clamp-2">
                                {item.name}
                              </h4>
                              {item.price != null && item.price !== "" && (
                                <p className="text-sm font-semibold text-wood-900">
                                  {formatPrice(item.price)}
                                </p>
                              )}
                            </div>
                            {item.description && (
                              <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-all duration-200 ${
                                isActive ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                              }`}>
                                <div className="mx-1 mb-1 rounded-2xl bg-white text-wood-800 text-[11px] leading-snug p-3 shadow-xl backdrop-blur-md max-h-40 overflow-y-auto">
                                  <p className="whitespace-pre-line">{item.description}</p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addItem(item, 1);
                                    }}
                                    className="mt-2 w-full rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-wood-950 hover:bg-accent-hover transition-colors pointer-events-auto"
                                  >
                                    Add to cart
                                  </button>
                                </div>
                              </div>
                            )}
                            {!item.description && (
                              <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-all duration-200 ${
                                isActive ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                              }`}>
                                <div className="mx-1 mb-1 rounded-2xl bg-white text-wood-800 text-[11px] leading-snug p-3 shadow-xl backdrop-blur-md">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addItem(item, 1);
                                    }}
                                    className="w-full rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-wood-950 hover:bg-accent-hover transition-colors pointer-events-auto"
                                  >
                                    Add to cart
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        )})}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && !error && (
          <section className="glass mt-12 md:mt-16 rounded-2xl p-6 md:p-8 border border-white/10">
            <h2 className="mb-6 text-xl md:text-2xl font-semibold text-wood-900 border-b border-white/10 pb-4">
              Information
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 w-full">
              <div>
                <h3 className="mb-4 text-[17px] font-medium text-wood-900">Opening Hours</h3>
                {openingHours.length > 0 ? (
                  <p className="text-[16px] text-wood-600 leading-relaxed">
                    {formatOpeningHoursSentence(openingHours)}
                  </p>
                ) : (
                  <p className="text-[16px] text-wood-600">Opening hours not available.</p>
                )}
              </div>
              <div>
                <h3 className="mb-4 text-[17px] font-medium text-wood-900">Location & Contact</h3>
                {restaurant?.address && (
                  <div className="mb-4">
                    <p className="font-medium text-wood-700">Address</p>
                    <p className="text-[16px] text-wood-600">{restaurant.address}</p>
                  </div>
                )}
                {restaurant?.phone && (
                  <div>
                    <p className="font-medium text-wood-700">Phone</p>
                    <p className="text-[16px] text-wood-600">{restaurant.phone}</p>
                  </div>
                )}
                {!restaurant?.address && !restaurant?.phone && (
                  <p className="text-[16px] text-wood-600">Location details not available.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Google maps - full width at the bottom */}
        <section className="mt-12 md:mt-16 w-screen relative left-1/2 -translate-x-1/2">
          <div className="h-[320px] sm:h-[380px] md:h-[450px] w-full overflow-hidden">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3998.6603720699095!2d-9.152773323431077!3d38.754076455147136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd19332be308e0b9%3A0xd5f9201a9f240b46!2sLusiqueira%20Burger%20and%20Grill%20Restaurant!5e1!3m2!1sen!2spt!4v1773770427867!5m2!1sen!2spt"
              width="100%"
              height="100%"
              style={{ border: 0, width: "100%", height: "100%" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
