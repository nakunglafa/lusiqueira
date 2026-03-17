"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { getRestaurant } from "@/lib/api";

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
        <section className="mb-10 text-center md:mb-16">
          {loading ? (
            <div className="py-20 text-[17px] text-wood-600">Loading...</div>
          ) : error ? (
            <div className="py-20 text-[17px] text-red-400">{error}</div>
          ) : (
            <div className="glass-strong rounded-3xl p-8 md:p-12 text-left max-w-3xl mx-auto border border-white/10 shadow-2xl">
              {restaurant?.logo_url && (
                <div className="mb-6 flex justify-center">
                  <img src={restaurant.logo_url} alt={`${restaurant.name} logo`} className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover shadow-xl ring-2 ring-wood-500/50 ring-offset-2 ring-offset-transparent" />
                </div>
              )}
              <h1 className="mb-4 text-3xl font-bold tracking-tight text-wood-900 sm:text-5xl">
                {restaurant?.name || "Our Restaurant"}
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
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 px-2 sm:px-0">
                <Link
                  href="/menu"
                  className="w-full sm:w-auto rounded-full border-2 border-wood-500/60 bg-white/5 px-8 py-3.5 text-[17px] font-medium text-wood-900 hover:bg-white/10 hover:border-wood-500 transition-colors backdrop-blur-sm"
                >
                  View Menu
                </Link>
                <Link
                  href="/book"
                  className="w-full sm:w-auto rounded-full bg-accent px-8 py-3.5 text-[17px] font-medium text-wood-950 hover:bg-accent-hover text-center transition-colors shadow-lg hover:shadow-xl"
                >
                  Book a Table
                </Link>
              </div>
            </div>
          )}
        </section>

        {!loading && !error && specialItems.length > 0 && (
          <section className="mb-12 md:mb-16">
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
            <div className="-mx-4 px-4">
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-wood-400/70 scrollbar-track-transparent">
                {specialItems.map((item) => (
                  <article
                    key={item.id ?? item.menu_item_id}
                    className="relative w-56 shrink-0 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="relative h-40 w-full overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name ?? "Special item"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-wood-300/40 text-wood-700 text-sm font-semibold">
                          {item.name ?? "Special item"}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/30 to-transparent px-3 py-2">
                        <p className="text-sm font-semibold text-white line-clamp-2">
                          {item.name}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      {item.price != null && item.price !== "" && (
                        <p className="text-sm font-semibold text-wood-900">
                          {formatPrice(item.price)}
                        </p>
                      )}
                      {item.description && (
                        <p className="mt-1 text-xs text-wood-600 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {!loading && !error && (
          <section className="glass mt-12 md:mt-16 rounded-2xl p-6 md:p-8 border border-white/10">
            <h2 className="mb-6 text-xl md:text-2xl font-semibold text-wood-900 border-b border-white/10 pb-4">
              Information
            </h2>
            <div className="grid gap-8 sm:grid-cols-2">
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
      </main>
    </div>
  );
}
