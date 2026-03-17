"use client";

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

function CategorySection({ category, addItem, isNested = false }) {
  const items = Array.isArray(category.items)
    ? category.items
    : toArray(category.items || []);
  const children = Array.isArray(category.children)
    ? category.children
    : toArray(category.children || []);

  const HeadingTag = isNested ? "h4" : "h3";
  const headingClass = isNested
    ? "text-base font-semibold text-wood-800 text-center"
    : "text-lg font-semibold text-wood-900 text-center";

  return (
    <div className={isNested ? "mt-6" : ""}>
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
              <HeadingTag className={headingClass}>{category.name}</HeadingTag>
            )}
            {category.description && (
              <p className="mt-1 text-sm text-wood-600">
                {category.description}
              </p>
            )}
          </div>
        </div>
      )}
      {items.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {items.map((item) => (
            <MenuItemCard
              key={item.id ?? item.name ?? Math.random()}
              item={item}
              addItem={addItem}
            />
          ))}
        </ul>
      )}
      {children.map((child) => (
        <CategorySection
          key={child.id ?? child.name ?? Math.random()}
          category={child}
          addItem={addItem}
          isNested
        />
      ))}
    </div>
  );
}

export function MenuClient({ restaurant, menus }) {
  const { addItem } = useCart();

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12 pb-24 md:pb-24">
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
          <div className="space-y-12">
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
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

