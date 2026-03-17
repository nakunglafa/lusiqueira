"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { toArray } from "@/lib/owner-utils";
import { useCart } from "@/context/CartContext";

function formatPrice(value) {
  if (value == null || value === "") return "";
  const n =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function MenuItemCard({ item, addItem }) {
  return (
    <li className="flex gap-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 hover:bg-white/10 hover:border-wood-500/30 transition-all">
      {item.image_url && (
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-wood-300/50 sm:h-32 sm:w-32">
          <img
            src={item.image_url}
            alt={item.name ? item.name : "Menu item"}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium text-wood-900">{item.name}</span>
          {item.price != null && item.price !== "" && (
            <span className="text-wood-600">{formatPrice(item.price)}</span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-sm text-wood-600">{item.description}</p>
        )}
        {item.dietary_info && (
          <p className="mt-1 text-xs text-wood-500">{item.dietary_info}</p>
        )}
        {item.price != null &&
          item.price !== "" &&
          item.is_available !== false && (
            <button
              type="button"
              onClick={() => addItem(item, 1)}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-wood-950 hover:bg-accent-hover transition-colors"
            >
              Add to Cart
            </button>
          )}
      </div>
    </li>
  );
}

function normalizeText(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

function sentenceCase(s) {
  const str = String(s ?? "");
  if (!str.trim()) return str;
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function CategorySection({ category, addItem, isNested = false, searchTerm }) {
  const items = Array.isArray(category.items)
    ? category.items
    : toArray(category.items || []);
  const children = Array.isArray(category.children)
    ? category.children
    : toArray(category.children || []);

  const term = normalizeText(searchTerm);
  const matchesItem = (item) => {
    if (!term) return true;
    const name = normalizeText(item?.name);
    const desc = normalizeText(item?.description);
    return name.includes(term) || desc.includes(term);
  };

  const filteredItems = items.filter(matchesItem);
  const shouldShowCategory = !term
    ? true
    : filteredItems.length > 0 || children.some((child) => CategorySectionPreviewMatches(child, term));

  const HeadingTag = isNested ? "h4" : "h3";
  const headingClass = isNested
    ? "text-base font-semibold text-wood-800 text-center"
    : "text-lg font-semibold text-wood-900 text-center";

  if (!shouldShowCategory) return null;

  return (
    <div
      id={category?.id != null ? `menu-cat-${String(category.id)}` : undefined}
      className={isNested ? "mt-6" : ""}
    >
      {(category.name || category.description) && (
        <div className="mb-4 flex flex-col items-center gap-3 text-center">
          {category.image_url && (
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-wood-300/50">
              <img
                src={category.image_url}
                alt={category.name ? `${category.name} category` : "Category"}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div>
            {category.name && (
              <HeadingTag className={headingClass}>{sentenceCase(category.name)}</HeadingTag>
            )}
            {category.description && (
              <p className="mt-1 text-sm text-wood-600">
                {category.description}
              </p>
            )}
          </div>
        </div>
      )}
      {filteredItems.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id ?? item.name ?? "menu-item"}
              item={item}
              addItem={addItem}
            />
          ))}
        </ul>
      )}
      {children.map((child) => (
        <CategorySection
          key={child.id ?? child.name ?? "menu-category"}
          category={child}
          addItem={addItem}
          isNested
          searchTerm={searchTerm}
        />
      ))}
    </div>
  );
}


function CategorySectionPreviewMatches(category, term) {
  const items = Array.isArray(category?.items) ? category.items : toArray(category?.items || []);
  const children = Array.isArray(category?.children) ? category.children : toArray(category?.children || []);
  const matchesItem = (item) => {
    const name = normalizeText(item?.name);
    const desc = normalizeText(item?.description);
    return name.includes(term) || desc.includes(term);
  };
  if (items.some(matchesItem)) return true;
  return children.some((c) => CategorySectionPreviewMatches(c, term));
}

function SpecialMenuSection({ specialMenu, addItem, searchTerm }) {
  const term = normalizeText(searchTerm);
  const items = Array.isArray(specialMenu?.items) ? specialMenu.items : toArray(specialMenu?.items || []);
  const filtered = !term
    ? items
    : items.filter((it) => normalizeText(it?.name).includes(term) || normalizeText(it?.description).includes(term));

  if (!filtered.length) return null;

  return (
    <section className="glass rounded-2xl overflow-hidden border border-white/10">
      <div className="divide-y divide-white/10">
        <div className="px-6 py-6">
          <h2 className="text-2xl md:text-3xl font-bold text-wood-900 text-center">
            {specialMenu?.name || "Special"}
          </h2>
          <p className="mt-2 text-center text-wood-600 text-sm md:text-base">
            Special menu items
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {filtered.map((item) => (
              <MenuItemCard key={item.id ?? item.name ?? "special-item"} item={item} addItem={addItem} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function MenuClient({ restaurant, menus, specialMenuLists }) {
  const { addItem } = useCart();
  const [searchTerm, setSearchTerm] = useState("");

  // sidebar: top-level categories (in order) for quick jumps + filtering UI
  const buildSidebar = (menu) => {
    const categories = Array.isArray(menu?.categories) ? menu.categories : toArray(menu?.categories || menu);
    const out = [];
    const walk = (cat, depth) => {
      const id = String(cat?.id ?? cat?.name ?? "").toString();
      if (cat && cat.name) {
        out.push({ id: id || cat.name, name: cat.name, depth });
      }
      const children = Array.isArray(cat?.children) ? cat.children : toArray(cat?.children || []);
      children.forEach((c) => walk(c, depth + 1));
    };
    categories.forEach((c) => walk(c, 0));
    return out;
  };

  const sidebarCategories = Array.isArray(menus) && menus.length > 0 ? buildSidebar(menus[0]) : [];

  const jumpId = `cat-${encodeURIComponent(sidebarCategories[0]?.id ?? "top")}`;

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12 pb-32 md:pb-24">
        {restaurant?.name && (
          <div className="mb-6 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-wood-900">
              {restaurant.name}
            </h1>
            {restaurant.cuisine && (
              <p className="mt-2 text-wood-600">{restaurant.cuisine}</p>
            )}
          </div>
        )}

        {!menus || menus.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center border border-white/10">
            <p className="text-wood-600">No menu available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8 items-start">
            {/* Mobile top bar: horizontal categories */}
            <div className="lg:hidden w-full sticky top-16 z-40 pt-2">
              <div className="glass rounded-2xl px-4 py-3 border border-white/10 bg-wood-100/70 backdrop-blur-xl overflow-x-auto">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-wood-900 shrink-0">Categories</h3>
                  <div className="flex gap-2">
                    {sidebarCategories.slice(0, 30).map((c) => (
                      <a
                        key={`${c.id}-${c.depth}`}
                        href={c.id ? `#menu-cat-${c.id}` : "#menu-categories"}
                        className="shrink-0 inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-wood-700 hover:text-wood-950"
                        title={c.name}
                      >
                        {sentenceCase(c.name)}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop sidebar */}
            <aside className="hidden lg:block lg:sticky lg:top-16 z-40 space-y-4">
              <div className="glass rounded-2xl p-4 border border-white/10 bg-wood-100/70">
                <h3 className="text-lg font-semibold text-wood-900">Search</h3>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  type="text"
                  placeholder="Search dish or description..."
                  className="mt-3 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-wood-900 placeholder:text-wood-600 outline-none focus:border-wood-500/50"
                />
                <p className="mt-3 text-xs text-wood-600">Filters categories and special menus.</p>
              </div>

              <div className="glass rounded-2xl p-4 border border-white/10 bg-wood-100/60 max-h-[60vh] overflow-auto">
                <h3 className="text-lg font-semibold text-wood-900">Categories</h3>
                <div className="mt-3 space-y-2">
                  {sidebarCategories.slice(0, 30).map((c) => (
                    <a
                      key={`${c.id}-${c.depth}`}
                      href={c.id ? `#menu-cat-${c.id}` : "#menu-categories"}
                      className="block text-sm text-wood-700 hover:text-wood-950"
                      title={c.name}
                    >
                      <span style={{ marginLeft: `${c.depth * 10}px` }}>
                        {sentenceCase(c.name)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </aside>

            {/* Content */}
            <div className="space-y-12" id="menu-categories">
              {Array.isArray(specialMenuLists) && specialMenuLists.length > 0 &&
                specialMenuLists.map((sm) => (
                  <SpecialMenuSection
                    key={sm.id ?? sm.name ?? "special-menu"}
                    specialMenu={sm}
                    addItem={addItem}
                    searchTerm={searchTerm}
                  />
                ))}

              {menus.map((menu) => {
                const categories = Array.isArray(menu.categories)
                  ? menu.categories
                  : toArray(menu.categories || menu);
                return (
                  <section
                    key={menu.id ?? menu.name ?? Math.random()}
                    className="glass rounded-2xl overflow-hidden border border-white/10"
                  >
                    <div className="divide-y divide-white/10">
                      {categories.map((category) => (
                        <div
                          key={category.id ?? category.name ?? Math.random()}
                          className="px-6 py-6"
                        >
                          <CategorySection
                            category={category}
                            addItem={addItem}
                            searchTerm={searchTerm}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Mobile bottom bar: fixed search */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-3 bg-linear-to-t from-wood-100/95 to-transparent">
        <div className="glass rounded-2xl border border-white/10 bg-wood-100/55 backdrop-blur-xl p-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-wood-900 shrink-0">Search</h3>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              type="text"
              placeholder="Search dish or description..."
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-wood-900 placeholder:text-wood-600 outline-none focus:border-wood-500/50"
            />
          </div>
          <p className="mt-2 text-[11px] text-wood-600">Filters categories and special menus.</p>
        </div>
      </div>
    </div>
  );
}

