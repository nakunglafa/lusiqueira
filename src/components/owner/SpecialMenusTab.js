"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Toast } from "@/components/Toast";
import {
  getSpecialMenusForRestaurant,
  createSpecialMenu,
  updateSpecialMenu,
  deleteSpecialMenu,
  updateSpecialMenuItems,
  getRestaurant,
} from "@/lib/api";
import { toArray } from "@/lib/owner-utils";

export function SpecialMenusTab({ restaurantId, token }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("error");

  const [creating, setCreating] = useState(false);
  const [newList, setNewList] = useState({
    name: "",
    description: "",
    is_active: true,
    sort_order: 0,
  });

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const [menuItems, setMenuItems] = useState([]);
  const [itemsByList, setItemsByList] = useState({});
  const [savingItemsFor, setSavingItemsFor] = useState(null);

  const showToast = useCallback((message, type = "error") => {
    setToastMessage(message);
    setToastType(type);
  }, []);

  const loadLists = useCallback(async () => {
    if (!restaurantId || !token) return;
    setLoading(true);
    setError("");
    try {
      const res = await getSpecialMenusForRestaurant(token, restaurantId);
      const arr = toArray(res?.data ?? res);
      // Response is paginated in API docs; prefer data.data when present.
      const dataList = Array.isArray(arr?.data) ? arr.data : arr;
      const normalized = toArray(dataList);
      setLists(normalized);
      const initialItems = {};
      normalized.forEach((list) => {
        const items = Array.isArray(list.items) ? list.items : [];
        initialItems[list.id] = items.map((it) => it.id ?? it.menu_item_id).filter(Boolean);
      });
      setItemsByList(initialItems);
    } catch (err) {
      const msg = err?.data?.message || err?.message || "Failed to load special menus";
      setError(msg);
      setLists([]);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, token, showToast]);

  const loadMenuItems = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await getRestaurant(restaurantId);
      const restaurant = res?.restaurant ?? res?.data?.restaurant ?? res;
      const menus = toArray(restaurant?.menus);
      const collected = [];
      menus.forEach((menu) => {
        const categories = toArray(menu?.categories);
        categories.forEach((cat) => {
          const items = toArray(cat?.items);
          items.forEach((item) => {
            if (!item) return;
            collected.push({
              id: item.id,
              name: item.name,
              price: item.price,
              is_available: item.is_available !== false,
              category: cat.name,
              menu: menu.name,
            });
          });
          const children = toArray(cat?.children);
          children.forEach((sub) => {
            const subItems = toArray(sub?.items);
            subItems.forEach((item) => {
              if (!item) return;
              collected.push({
                id: item.id,
                name: item.name,
                price: item.price,
                is_available: item.is_available !== false,
                category: `${cat.name} › ${sub.name}`,
                menu: menu.name,
              });
            });
          });
        });
      });
      setMenuItems(collected);
    } catch (err) {
      // Non-fatal for the tab; lists can still be managed without item assignment UI.
    }
  }, [restaurantId]);

  useEffect(() => {
    loadLists();
    loadMenuItems();
  }, [loadLists, loadMenuItems]);

  const availableItems = useMemo(
    () => menuItems.filter((i) => i.is_available),
    [menuItems]
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!newList.name.trim()) {
      showToast("Name is required.", "error");
      return;
    }
    try {
      await createSpecialMenu(token, restaurantId, {
        name: newList.name.trim(),
        description: newList.description || "",
        is_active: newList.is_active,
        sort_order: Number(newList.sort_order) || 0,
      });
      setNewList({ name: "", description: "", is_active: true, sort_order: 0 });
      setCreating(false);
      showToast("Special list created.", "success");
      loadLists();
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to create list", "error");
    }
  }

  async function handleUpdate(list) {
    const vals = editValues[list.id] || {};
    const name = (vals.name ?? list.name ?? "").trim();
    if (!name) {
      showToast("Name is required.", "error");
      return;
    }
    try {
      await updateSpecialMenu(token, list.id, {
        name,
        description: vals.description ?? list.description ?? "",
        is_active: vals.is_active ?? (list.is_active ?? true),
        sort_order: Number(vals.sort_order ?? list.sort_order ?? 0),
      });
      setEditingId(null);
      showToast("List updated.", "success");
      loadLists();
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to update list", "error");
    }
  }

  async function handleDelete(listId) {
    if (!confirm("Delete this special list? Items will just stop showing in this list.")) return;
    try {
      await deleteSpecialMenu(token, listId);
      showToast("List deleted.", "success");
      loadLists();
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to delete list", "error");
    }
  }

  async function handleSaveItems(listId) {
    const selected = itemsByList[listId] || [];
    setSavingItemsFor(listId);
    try {
      await updateSpecialMenuItems(token, listId, selected);
      showToast("Items updated for this list.", "success");
      loadLists();
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to update items", "error");
    } finally {
      setSavingItemsFor(null);
    }
  }

  if (loading && !lists.length) {
    return <p className="py-8 text-owner-muted">Loading special menus...</p>;
  }

  return (
    <div className="space-y-6 max-w-full min-w-0 relative">
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage(null)}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/60">
          <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
          <button
            type="button"
            onClick={loadLists}
            className="touch-manipulation mt-2 min-h-[40px] rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-2">
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="touch-manipulation min-h-[48px] flex-1 rounded-xl bg-owner-action px-5 py-3 text-base md:text-sm font-medium text-white hover:opacity-90 active:scale-[0.98] sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
        >
          {creating ? "Close form" : "Create special list"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="owner-card rounded-xl border border-owner-border bg-owner-card p-4 space-y-3"
        >
          <h3 className="font-medium text-owner-charcoal text-base">New special menu list</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-owner-muted">Name *</span>
              <input
                type="text"
                required
                value={newList.name}
                onChange={(e) => setNewList((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Chef's Specials"
                className="rounded-lg border border-owner-border bg-owner-paper px-3 py-2 text-owner-charcoal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-owner-muted">Sort order</span>
              <input
                type="number"
                value={newList.sort_order}
                onChange={(e) =>
                  setNewList((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))
                }
                className="rounded-lg border border-owner-border bg-owner-paper px-3 py-2 text-owner-charcoal"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-owner-muted">Description (optional)</span>
            <textarea
              rows={2}
              value={newList.description}
              onChange={(e) => setNewList((p) => ({ ...p, description: e.target.value }))}
              className="rounded-lg border border-owner-border bg-owner-paper px-3 py-2 text-sm text-owner-charcoal"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newList.is_active}
              onChange={(e) =>
                setNewList((p) => ({ ...p, is_active: e.target.checked }))
              }
              className="rounded border-owner-border"
            />
            <span className="text-owner-muted">Active (visible on customer site)</span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            <button
              type="submit"
              className="touch-manipulation min-h-[48px] flex-1 rounded-xl bg-owner-action px-5 py-3 text-base md:text-sm font-medium text-white hover:opacity-90 sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
            >
              Create list
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="touch-manipulation min-h-[48px] flex-1 rounded-xl border border-owner-border px-5 py-3 text-base md:text-sm font-medium text-owner-charcoal hover:bg-owner-paper sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {lists.length === 0 && !creating ? (
        <p className="py-8 text-owner-muted">
          No special lists yet. Create one to highlight certain items on the customer site.
        </p>
      ) : (
        <ul className="space-y-4">
          {lists.map((list) => {
            const isEditing = editingId === list.id;
            const vals = editValues[list.id] || {};
            const selectedItemIds = itemsByList[list.id] || [];
            return (
              <li
                key={list.id}
                className="owner-card rounded-xl border border-owner-border bg-owner-card p-4 space-y-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0 space-y-1">
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={vals.name ?? list.name ?? ""}
                          onChange={(e) =>
                            setEditValues((p) => ({
                              ...p,
                              [list.id]: { ...(p[list.id] || {}), name: e.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-owner-border bg-owner-paper px-3 py-2 text-sm font-medium text-owner-charcoal"
                        />
                        <textarea
                          rows={2}
                          value={vals.description ?? list.description ?? ""}
                          onChange={(e) =>
                            setEditValues((p) => ({
                              ...p,
                              [list.id]: {
                                ...(p[list.id] || {}),
                                description: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-owner-border bg-owner-paper px-3 py-2 text-xs text-owner-charcoal"
                        />
                        <div className="flex flex-wrap gap-3 mt-1">
                          <label className="flex items-center gap-2 text-xs">
                            <span className="text-owner-muted">Sort order</span>
                            <input
                              type="number"
                              value={vals.sort_order ?? list.sort_order ?? 0}
                              onChange={(e) =>
                                setEditValues((p) => ({
                                  ...p,
                                  [list.id]: {
                                    ...(p[list.id] || {}),
                                    sort_order: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="w-20 rounded-lg border border-owner-border bg-owner-paper px-2 py-1 text-xs text-owner-charcoal"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={
                                vals.is_active ??
                                (list.is_active !== undefined ? list.is_active : true)
                              }
                              onChange={(e) =>
                                setEditValues((p) => ({
                                  ...p,
                                  [list.id]: {
                                    ...(p[list.id] || {}),
                                    is_active: e.target.checked,
                                  },
                                }))
                              }
                              className="rounded border-owner-border"
                            />
                            <span className="text-owner-muted">Active</span>
                          </label>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-owner-charcoal text-base truncate">
                            {list.name}
                          </h3>
                          {list.is_active && (
                            <span className="inline-flex items-center rounded-full bg-owner-success/15 px-2 py-0.5 text-[11px] font-medium text-owner-success">
                              Active
                            </span>
                          )}
                        </div>
                        {list.description && (
                          <p className="text-sm text-owner-muted line-clamp-2">
                            {list.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-owner-muted">
                          Sort order: {list.sort_order ?? 0} · Items:{" "}
                          {Array.isArray(list.items) ? list.items.length : 0}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdate(list)}
                          className="touch-manipulation min-h-[40px] rounded-lg bg-owner-action px-3 py-2 text-xs font-medium text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="touch-manipulation min-h-[40px] rounded-lg border border-owner-border px-3 py-2 text-xs font-medium text-owner-charcoal"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(list.id);
                            setEditValues((p) => ({
                              ...p,
                              [list.id]: {
                                name: list.name,
                                description: list.description ?? "",
                                sort_order: list.sort_order ?? 0,
                                is_active: list.is_active ?? true,
                              },
                            }));
                          }}
                          className="touch-manipulation min-h-[40px] rounded-lg border border-owner-border px-3 py-2 text-xs font-medium text-owner-charcoal hover:bg-owner-paper"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(list.id)}
                          className="touch-manipulation min-h-[40px] rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {availableItems.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs font-medium text-owner-muted">
                      Items in this list
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-owner-border bg-owner-paper/40 p-2 space-y-1">
                      {availableItems.map((item) => {
                        const checked = selectedItemIds.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-owner-paper"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const isOn = e.target.checked;
                                  setItemsByList((prev) => {
                                    const current = prev[list.id] || [];
                                    if (isOn) {
                                      if (current.includes(item.id)) return prev;
                                      return {
                                        ...prev,
                                        [list.id]: [...current, item.id],
                                      };
                                    }
                                    return {
                                      ...prev,
                                      [list.id]: current.filter((id) => id !== item.id),
                                    };
                                  });
                                }}
                                className="rounded border-owner-border"
                              />
                              <span className="truncate">
                                {item.name}
                                {item.category ? (
                                  <span className="ml-1 text-[11px] text-owner-muted">
                                    · {item.category}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            {item.price != null && (
                              <span className="shrink-0 text-[11px] text-owner-muted">
                                {typeof item.price === "number"
                                  ? item.price.toFixed(2)
                                  : item.price}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveItems(list.id)}
                      disabled={savingItemsFor === list.id}
                      className="touch-manipulation mt-1 min-h-[40px] rounded-lg bg-owner-action px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {savingItemsFor === list.id ? "Saving..." : "Save items for this list"}
                    </button>
                  </div>
                )}
                {availableItems.length === 0 && (
                  <p className="text-xs text-owner-muted">
                    No available menu items found. Make sure your menu has items marked as available.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

