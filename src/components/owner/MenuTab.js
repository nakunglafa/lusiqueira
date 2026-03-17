"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMenusForRestaurant,
  createMenuForRestaurant,
  updateMenu,
  deleteMenu,
  getCategoriesForMenu,
  createCategoryForMenu,
  updateCategory,
  deleteCategory,
  getItemsForCategory,
  createItemForCategory,
  updateItem,
  deleteItem,
} from "@/lib/api";
import { toArray } from "@/lib/owner-utils";
import { Toast } from "@/components/Toast";
import { ImageUploadDropzone, MAX_MENU_IMAGE_BYTES } from "@/components/owner/ImageUploadDropzone";

/** Flatten API categories when they come as main[] with nested .children so all categories are in one list and findable by id. */
function flattenCategories(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const c of arr) {
    out.push({ ...c, children: undefined });
    if (Array.isArray(c.children) && c.children.length > 0) {
      for (const sub of c.children) out.push({ ...sub });
    }
  }
  return out;
}

export function MenuTab({ restaurantId, token }) {
  const [menus, setMenus] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("error");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});
  const [itemsRefreshTrigger, setItemsRefreshTrigger] = useState(0);
  const [categoriesRefreshTrigger, setCategoriesRefreshTrigger] = useState(0);
  const [imageCacheBust, setImageCacheBust] = useState(0);
  const [selectedMenuCategories, setSelectedMenuCategories] = useState([]);
  const [openMainCatForm, setOpenMainCatForm] = useState(false);
  const [openSubCatForm, setOpenSubCatForm] = useState(false);

  const showToast = useCallback((message, type = "error") => {
    setToastMessage(message);
    setToastType(type);
  }, []);

  const loadMenus = useCallback(() => {
    if (!restaurantId || !token) return;
    setLoading(true);
    setError("");
    getMenusForRestaurant(token, restaurantId)
      .then((res) => {
        const list = toArray(res);
        setMenus(list);
        // Initialize selected menu if none is selected yet
        setSelectedMenuId((prev) => prev ?? (list[0]?.id ?? null));
        setImageCacheBust((t) => t + 1);
      })
      .catch((err) => {
        setError(err?.data?.message || err?.message || "Failed to load menus");
        setMenus([]);
        showToast(err?.data?.message || err?.message || "Failed to load menus", "error");
      })
      .finally(() => setLoading(false));
  }, [restaurantId, token, showToast]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  // Load categories for the selected menu so the left sidebar can add main/sub categories
  useEffect(() => {
    if (!selectedMenuId || !token) return;
    (async () => {
      try {
        const res = await getCategoriesForMenu(token, selectedMenuId);
        setSelectedMenuCategories(toArray(res));
      } catch {
        setSelectedMenuCategories([]);
      }
    })();
  }, [selectedMenuId, token, categoriesRefreshTrigger]);

  const loadCategories = useCallback(
    async (menuId) => {
      if (!token) return [];
      const res = await getCategoriesForMenu(token, menuId);
      return toArray(res);
    },
    [token]
  );

  const loadItems = useCallback(
    async (categoryId) => {
      if (!token) return [];
      const res = await getItemsForCategory(token, categoryId);
      const arr = toArray(res);
      return Array.isArray(arr) ? arr : [];
    },
    [token]
  );

  const handleCreateMenu = async (e) => {
    e.preventDefault();
    const name = formData.menuName?.trim();
    if (!name) return;
    try {
      await createMenuForRestaurant(token, restaurantId, { name });
      setFormData({});
      loadMenus();
      showToast("Menu created.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to create menu", "error");
    }
  };

  const handleUpdateMenu = async (menu) => {
    const name = (formData[`menu-${menu.id}`] ?? menu.name)?.trim();
    if (!name) return;
    try {
      await updateMenu(token, menu.id, { name });
      setEditing(null);
      loadMenus();
      showToast("Menu updated.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to update menu", "error");
    }
  };

  const handleDeleteMenu = async (menuId) => {
    if (!confirm("Delete this menu and all its categories/items?")) return;
    try {
      await deleteMenu(token, menuId);
      loadMenus();
      showToast("Menu deleted.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to delete menu", "error");
    }
  };

  const handleCreateCategory = async (menuId, type = "main") => {
    const key = type === "main" ? `cat-main-${menuId}` : `cat-sub-${menuId}`;
    const data = formData[key] ?? {};
    const name = (typeof data === "string" ? data : data.name)?.trim();
    if (!name) {
      showToast("Category name is required.", "error");
      return;
    }
    const parentId = type === "main" ? null : (typeof data === "object" ? data.parent_id : null);
    if (type === "sub" && !parentId) {
      showToast("Please select a parent category for the sub-category.", "error");
      return;
    }
    try {
      const imageFile = typeof data === "object" ? data._imageFile : null;
      const description = typeof data === "object" ? (data.description || "") : "";
      const sortOrder = typeof data === "object" ? (data.sort_order ?? "") : "";

      if (imageFile instanceof File && imageFile.size > 0) {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("description", description);
        if (sortOrder !== "" && sortOrder !== undefined) fd.append("sort_order", String(sortOrder));
        if (parentId) fd.append("parent_id", String(parentId));
        fd.append("image", imageFile, imageFile.name || "image.jpg");
        fd.append("data[image]", imageFile, imageFile.name || "image.jpg");
        await createCategoryForMenu(token, menuId, fd);
      } else {
        await createCategoryForMenu(token, menuId, {
          name,
          description,
          ...(sortOrder !== "" && sortOrder !== undefined && { sort_order: Number(sortOrder) }),
          ...(parentId && { parent_id: Number(parentId) }),
        });
      }
      setError("");
      setFormData((p) => ({ ...p, [key]: {} }));
      setCategoriesRefreshTrigger((t) => t + 1);
      showToast("Category created.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to create category", "error");
    }
  };

  const handleUpdateCategory = async (category, imageFile = null) => {
    const data = formData[`edit-cat-${category.id}`] ?? category;
    const name = (data.name ?? category.name)?.trim();
    if (!name) {
      showToast("Category name is required.", "error");
      return;
    }
    try {
      if (imageFile instanceof File && imageFile.size > 0) {
        const fd = new FormData();
        fd.append("_method", "PATCH");
        fd.append("name", name);
        fd.append("description", data.description ?? category.description ?? "");
        fd.append("sort_order", String(data.sort_order ?? category.sort_order ?? 0));
        if (data.parent_id !== undefined) fd.append("parent_id", data.parent_id ? String(data.parent_id) : "");
        fd.append("image", imageFile, imageFile.name || "image.jpg");
        fd.append("data[image]", imageFile, imageFile.name || "image.jpg");
        await updateCategory(token, category.id, fd);
      } else {
        await updateCategory(token, category.id, {
          name,
          description: data.description ?? category.description ?? "",
          sort_order: Number(data.sort_order ?? category.sort_order ?? 0),
          ...(data.parent_id !== undefined && { parent_id: data.parent_id || null }),
        });
      }
      setEditing(null);
      setCategoriesRefreshTrigger((t) => t + 1);
      showToast("Category updated.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to update category", "error");
    }
  };

  const handleMoveCategory = async (categoryId, newParentId, newSortOrder) => {
    try {
      await updateCategory(token, categoryId, {
        parent_id: newParentId || null,
        ...(newSortOrder !== undefined && { sort_order: newSortOrder }),
      });
      setCategoriesRefreshTrigger((t) => t + 1);
      showToast("Category moved.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to move category", "error");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm("Delete this category and all its sub-categories and items?")) return;
    try {
      await deleteCategory(token, categoryId);
      setCategoriesRefreshTrigger((t) => t + 1);
      showToast("Category deleted.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to delete category", "error");
    }
  };

  const handleCreateItem = async (categoryId, e) => {
    e.preventDefault();
    const data = formData[`item-${categoryId}`];
    if (!data?.name?.trim()) {
      showToast("Item name is required.", "error");
      throw new Error("validation");
    }
    const price = parseFloat(data.price);
    if (data.price === undefined || data.price === null || data.price === "" || Number.isNaN(price) || price < 0) {
      showToast("Price is required and must be 0 or greater.", "error");
      throw new Error("validation");
    }
    try {
      const imageFile = data._imageFile;
      if (imageFile instanceof File && imageFile.size > 0) {
        const fd = new FormData();
        fd.append("name", data.name.trim());
        fd.append("description", data.description || "");
        fd.append("price", String(price));
        fd.append("is_available", data.is_available !== false ? "1" : "0");
        fd.append("is_gluten_free", data.is_gluten_free ? "1" : "0");
        fd.append("is_vegan", data.is_vegan ? "1" : "0");
        fd.append("is_vegetarian", data.is_vegetarian ? "1" : "0");
        fd.append("image", imageFile, imageFile.name || "image.jpg");
        fd.append("data[image]", imageFile, imageFile.name || "image.jpg");
        await createItemForCategory(token, categoryId, fd);
      } else {
        await createItemForCategory(token, categoryId, {
          name: data.name.trim(),
          description: data.description || "",
          price,
          is_available: data.is_available !== false,
          is_gluten_free: data.is_gluten_free === true,
          is_vegan: data.is_vegan === true,
          is_vegetarian: data.is_vegetarian === true,
        });
      }
      setFormData((p) => ({ ...p, [`item-${categoryId}`]: {} }));
      setExpandedCategory(categoryId);
      showToast("Item created.", "success");
    } catch (err) {
      if (err?.message !== "validation") {
        showToast(err?.data?.message || err?.message || "Failed to create item", "error");
      }
    }
  };

  const handleUpdateItem = async (item) => {
    const data = formData[`edit-item-${item.id}`] ?? item;
    const imageFile = data._imageFile instanceof File ? data._imageFile : null;
    try {
      if (imageFile) {
        const fd = new FormData();
        fd.append("_method", "PATCH");
        fd.append("name", data.name?.trim() || item.name);
        fd.append("description", data.description ?? item.description ?? "");
        fd.append("price", String(parseFloat(data.price) ?? item.price ?? 0));
        fd.append("is_available", data.is_available !== false ? "1" : "0");
        fd.append("is_gluten_free", data.is_gluten_free === true ? "1" : "0");
        fd.append("is_vegan", data.is_vegan === true ? "1" : "0");
        fd.append("is_vegetarian", data.is_vegetarian === true ? "1" : "0");
        fd.append("image", imageFile, imageFile.name || "image.jpg");
        fd.append("data[image]", imageFile, imageFile.name || "image.jpg");
        await updateItem(token, item.id, fd);
      } else {
        await updateItem(token, item.id, {
          name: data.name?.trim() || item.name,
          description: data.description ?? item.description ?? "",
          price: parseFloat(data.price) ?? item.price,
          is_available: data.is_available !== false,
          is_gluten_free: data.is_gluten_free === true,
          is_vegan: data.is_vegan === true,
          is_vegetarian: data.is_vegetarian === true,
        });
      }
      setEditing(null);
      loadMenus();
      showToast("Item updated.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to update item", "error");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm("Delete this item?")) return;
    try {
      await deleteItem(token, itemId);
      loadMenus();
      showToast("Item deleted.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to delete item", "error");
    }
  };

  const handleMoveItem = async (itemId, fromCategoryId, toCategoryId) => {
    if (fromCategoryId === toCategoryId) return;
    try {
      await updateItem(token, itemId, { category_id: toCategoryId });
      setItemsRefreshTrigger((t) => t + 1);
      showToast("Item moved.", "success");
    } catch (err) {
      showToast(err?.data?.message || err?.message || "Failed to move item", "error");
    }
  };

  if (loading && menus.length === 0) return <p className="text-owner-muted">Loading menus...</p>;

  const selectedMenu = menus.find((m) => String(m.id) === String(selectedMenuId)) || menus[0] || null;
  const mainCategoriesForSelected =
    Array.isArray(selectedMenuCategories) ? selectedMenuCategories.filter((c) => !c.parent_id) : [];

  return (
    <div className="space-y-6 relative max-w-full min-w-0">
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage(null)}
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 p-3 flex items-center justify-between gap-2">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          <button type="button" onClick={loadMenus} className="touch-manipulation shrink-0 min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">
            Retry
          </button>
        </div>
      )}
      {/* Two columns: left = main menu + categories (forms), right = menu items (editor). */}
      <div
        data-menu-layout="two-col"
        className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] items-start gap-6 h-auto"
      >
        {/* Left: add menu + main category + sub-category forms */}
        <aside className="order-2 md:order-1 w-full md:w-[320px] lg:w-[360px] shrink-0 md:sticky md:top-4 mt-4 md:mt-6 space-y-6 md:pr-2 pb-6">
          <div className="rounded-xl border border-owner-border bg-white p-4 dark:bg-zinc-800/80 dark:border-zinc-600">
            <h3 className="text-lg md:text-base font-semibold text-zinc-800 dark:text-zinc-100">Menus</h3>
            <form onSubmit={handleCreateMenu} className="mt-2 flex flex-col gap-3">
              <input
                type="text"
                placeholder="New menu name"
                value={formData.menuName || ""}
                onChange={(e) => setFormData((p) => ({ ...p, menuName: e.target.value }))}
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base md:text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
              <button
                type="submit"
                className="touch-manipulation min-h-[44px] rounded-xl bg-owner-action px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Add Menu
              </button>
            </form>
          </div>

          {menus.length > 0 && (
            <div className="space-y-2 rounded-xl border border-owner-border bg-white p-4 dark:bg-zinc-800/80 dark:border-zinc-600">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Select menu</p>
              <div className="space-y-1">
                {menus.map((menu) => (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => {
                      setSelectedMenuId(menu.id);
                      setExpandedCategory(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      String(selectedMenu?.id) === String(menu.id)
                        ? "bg-owner-action text-white"
                        : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                    }`}
                  >
                    {menu.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedMenu && (
            <div className="space-y-4">
              {/* Main category: toggle to open/close form */}
              <div className="min-w-0 rounded-xl border border-owner-border bg-white dark:bg-zinc-800/80 p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenMainCatForm((v) => !v)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-zinc-800 dark:text-zinc-100"
                >
                  <span>Main category</span>
                  <span className="text-owner-muted">{openMainCatForm ? "▼ Close" : "▶ Add new"}</span>
                </button>
                {openMainCatForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreateCategory(selectedMenu.id, "main");
                      setOpenMainCatForm(false);
                    }}
                    className="mt-3 flex flex-col gap-3"
                  >
                    <input
                      type="text"
                      placeholder="Main category name *"
                      required
                      value={formData[`cat-main-${selectedMenu.id}`]?.name ?? ""}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          [`cat-main-${selectedMenu.id}`]: { ...(p[`cat-main-${selectedMenu.id}`] || {}), name: e.target.value },
                        }))
                      }
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={formData[`cat-main-${selectedMenu.id}`]?.description ?? ""}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          [`cat-main-${selectedMenu.id}`]: { ...(p[`cat-main-${selectedMenu.id}`] || {}), description: e.target.value },
                        }))
                      }
                      rows={2}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                    />
                    <ImageUploadDropzone
                      id={`cat-main-img-${selectedMenu.id}`}
                      label="Image (optional)"
                      value={formData[`cat-main-${selectedMenu.id}`]?._imageFile}
                      onChange={(file) =>
                        setFormData((p) => ({
                          ...p,
                          [`cat-main-${selectedMenu.id}`]: { ...(p[`cat-main-${selectedMenu.id}`] || {}), _imageFile: file ?? undefined },
                        }))
                      }
                      onError={showToast}
                      className="mt-1"
                      maxBytes={MAX_MENU_IMAGE_BYTES}
                      accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
                      dropHint="Drop image or click (max 2 MB). JPEG, PNG, JPG, GIF, SVG."
                    />
                    <button
                      type="submit"
                      className="touch-manipulation min-h-[44px] w-full rounded-xl bg-owner-action px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      Add main category
                    </button>
                  </form>
                )}
              </div>

              {mainCategoriesForSelected.length > 0 && (
                <div className="min-w-0 rounded-xl border border-owner-border bg-white dark:bg-zinc-800/80 p-4 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenSubCatForm((v) => !v)}
                    className="flex w-full items-center justify-between text-left text-sm font-semibold text-zinc-800 dark:text-zinc-100"
                  >
                    <span>Sub-category</span>
                    <span className="text-owner-muted">{openSubCatForm ? "▼ Close" : "▶ Add new"}</span>
                  </button>
                  {openSubCatForm && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCreateCategory(selectedMenu.id, "sub");
                        setOpenSubCatForm(false);
                      }}
                      className="mt-3 flex flex-col gap-3"
                    >
                      <input
                        type="text"
                        placeholder="Sub-category name *"
                        required
                        value={formData[`cat-sub-${selectedMenu.id}`]?.name ?? ""}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            [`cat-sub-${selectedMenu.id}`]: {
                              ...(p[`cat-sub-${selectedMenu.id}`] || {}),
                              name: e.target.value,
                              parent_id: p[`cat-sub-${selectedMenu.id}`]?.parent_id ?? mainCategoriesForSelected[0]?.id,
                            },
                          }))
                        }
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                      />
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Under main category</label>
                        <select
                          value={formData[`cat-sub-${selectedMenu.id}`]?.parent_id ?? mainCategoriesForSelected[0]?.id ?? ""}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              [`cat-sub-${selectedMenu.id}`]: {
                                ...(p[`cat-sub-${selectedMenu.id}`] || {}),
                                parent_id: e.target.value ? Number(e.target.value) : null,
                              },
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {mainCategoriesForSelected.map((mc) => (
                            <option key={mc.id} value={mc.id}>
                              {mc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        placeholder="Description (optional)"
                        value={formData[`cat-sub-${selectedMenu.id}`]?.description ?? ""}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            [`cat-sub-${selectedMenu.id}`]: { ...(p[`cat-sub-${selectedMenu.id}`] || {}), description: e.target.value },
                          }))
                        }
                        rows={2}
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                      />
                      <ImageUploadDropzone
                        id={`cat-sub-img-${selectedMenu.id}`}
                        label="Image (optional)"
                        value={formData[`cat-sub-${selectedMenu.id}`]?._imageFile}
                        onChange={(file) =>
                          setFormData((p) => ({
                            ...p,
                            [`cat-sub-${selectedMenu.id}`]: { ...(p[`cat-sub-${selectedMenu.id}`] || {}), _imageFile: file ?? undefined },
                          }))
                        }
                        onError={showToast}
                        className="mt-1"
                        maxBytes={MAX_MENU_IMAGE_BYTES}
                        accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
                        dropHint="Drop image or click (max 2 MB). JPEG, PNG, JPG, GIF, SVG."
                      />
                      <button
                        type="submit"
                        className="touch-manipulation min-h-[44px] w-full rounded-xl bg-owner-action px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                      >
                        Add sub-category
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right: menu items (selected menu’s categories + items editor) */}
        <section className="order-1 md:order-2 min-w-0 w-full space-y-3 md:pl-2 pb-6">
          {menus.length === 0 && (
            <p className="text-owner-muted">No menus yet. Create one in the left panel.</p>
          )}
          {menus.length > 0 && selectedMenu && (
            <MenuSection
              key={selectedMenu.id}
              menu={selectedMenu}
              token={token}
              expandedCategory={expandedCategory}
              setExpandedCategory={setExpandedCategory}
              editing={editing}
              setEditing={setEditing}
              formData={formData}
              setFormData={setFormData}
              loadCategories={loadCategories}
              loadItems={loadItems}
              refreshTrigger={itemsRefreshTrigger}
              onUpdateMenu={handleUpdateMenu}
              onDeleteMenu={handleDeleteMenu}
              onCreateCategory={handleCreateCategory}
              onCreateItem={handleCreateItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onMoveItem={handleMoveItem}
              categoriesRefreshTrigger={categoriesRefreshTrigger}
              onUpdateCategory={handleUpdateCategory}
              onMoveCategory={handleMoveCategory}
              onDeleteCategory={handleDeleteCategory}
              onImageError={(msg) => showToast(msg, "error")}
              imageCacheBust={imageCacheBust}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function MenuSection({
  menu,
  token,
  expandedCategory,
  setExpandedCategory,
  editing,
  setEditing,
  formData,
  setFormData,
  loadCategories,
  loadItems,
  refreshTrigger,
  categoriesRefreshTrigger,
  onUpdateMenu,
  onDeleteMenu,
  onCreateCategory,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onUpdateCategory,
  onMoveCategory,
  onDeleteCategory,
  onImageError,
  imageCacheBust = 0,
}) {
  const [categories, setCategories] = useState([]);
  const [loadingCat, setLoadingCat] = useState(false);

  useEffect(() => {
    setLoadingCat(true);
    loadCategories(menu.id).then((cats) => {
      setCategories(flattenCategories(Array.isArray(cats) ? cats : toArray(cats)));
      setLoadingCat(false);
    });
  }, [menu.id, loadCategories, categoriesRefreshTrigger]);

  const mainCategories = Array.isArray(categories) ? categories.filter((c) => !c.parent_id) : [];
  const getChildren = (parentId) =>
    Array.isArray(categories) ? categories.filter((c) => (c.parent_id || c.parentId) === parentId) : [];

  return (
    <div className="owner-card rounded-xl shadow-sm">
      <div className="flex items-center justify-between p-4 md:p-5">
        {editing === `menu-${menu.id}` ? (
          <div className="flex flex-1 gap-2">
            <input
              type="text"
              value={formData[`menu-${menu.id}`] ?? menu.name}
              onChange={(e) => setFormData((p) => ({ ...p, [`menu-${menu.id}`]: e.target.value }))}
              className="flex-1 rounded border border-owner-border bg-owner-card px-2 py-1 text-owner-charcoal"
            />
            <button
              type="button"
              onClick={() => onUpdateMenu(menu)}
              className="touch-manipulation min-h-[44px] rounded-lg bg-owner-action px-4 py-2.5 text-base md:text-sm font-medium text-white hover:opacity-90"
            >
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)} className="touch-manipulation min-h-[44px] rounded-lg px-4 py-2.5 text-base md:text-sm font-medium text-owner-muted hover:text-owner-charcoal">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 items-center gap-2 text-left text-lg font-bold text-owner-charcoal">
              {menu.name}
            </div>
            <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(`menu-${menu.id}`)}
              className="touch-manipulation min-h-[44px] min-w-[44px] rounded-lg px-4 py-2.5 text-base md:text-sm font-medium text-owner-muted hover:text-owner-charcoal"
            >
              Edit
            </button>
              <button
                type="button"
                onClick={() => onDeleteMenu(menu.id)}
                className="touch-manipulation min-h-[44px] min-w-[44px] rounded-lg px-4 py-2.5 text-base md:text-sm font-medium text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-owner-border p-4 md:p-6 lg:p-6">
        {loadingCat ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
        ) : (
          <div className="space-y-3 lg:space-y-4">
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Tap a category to expand it. Drag items from one category card to another to move them.
            </p>
            {Array.isArray(categories) && categories.length > 0 ? (
              <div data-menu-inner="accordion-main-and-subcategories" className="space-y-4">
                {mainCategories.map((main) => {
                  const subCats = getChildren(main.id);
                  return (
                    <div key={main.id} className="space-y-2">
                      {/* Main category card */}
                      <CategorySection
                        category={main}
                        parentCategory={null}
                        siblingCategories={mainCategories}
                        mainCategories={mainCategories}
                        token={token}
                        expandedCategory={expandedCategory}
                        setExpandedCategory={setExpandedCategory}
                        editing={editing}
                        setEditing={setEditing}
                        formData={formData}
                        setFormData={setFormData}
                        loadItems={loadItems}
                        refreshTrigger={refreshTrigger}
                        onCreateItem={onCreateItem}
                        onUpdateItem={onUpdateItem}
                        onDeleteItem={onDeleteItem}
                        onMoveItem={onMoveItem}
                        onUpdateCategory={onUpdateCategory}
                        onMoveCategory={onMoveCategory}
                        onDeleteCategory={onDeleteCategory}
                        onImageError={onImageError}
                        imageCacheBust={imageCacheBust}
                      />
                      {/* Its sub-categories, visually nested under the main */}
                      {subCats.map((sub) => (
                        <div key={sub.id} className="ml-3 border-l border-zinc-700/40 pl-3">
                          <CategorySection
                            category={sub}
                            parentCategory={main}
                            siblingCategories={subCats}
                            mainCategories={mainCategories}
                            token={token}
                            expandedCategory={expandedCategory}
                            setExpandedCategory={setExpandedCategory}
                            editing={editing}
                            setEditing={setEditing}
                            formData={formData}
                            setFormData={setFormData}
                            loadItems={loadItems}
                            refreshTrigger={refreshTrigger}
                            onCreateItem={onCreateItem}
                            onUpdateItem={onUpdateItem}
                            onDeleteItem={onDeleteItem}
                            onMoveItem={onMoveItem}
                            onUpdateCategory={onUpdateCategory}
                            onMoveCategory={onMoveCategory}
                            onDeleteCategory={onDeleteCategory}
                            onImageError={onImageError}
                            imageCacheBust={imageCacheBust}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                No categories yet. Use the forms on the left to add one.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategorySection({
  category,
  parentCategory,
  siblingCategories = [],
  mainCategories = [],
  token,
  expandedCategory,
  setExpandedCategory,
  editing,
  setEditing,
  formData,
  setFormData,
  loadItems,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onUpdateCategory,
  onMoveCategory,
  onDeleteCategory,
  onImageError,
  imageCacheBust = 0,
  refreshTrigger,
}) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState(null);
  const newItemNameInputRef = useRef(null);
  const [shouldFocusNewItem, setShouldFocusNewItem] = useState(false);

  const imageUrl = (url) => (url && imageCacheBust ? `${url}${url.includes("?") ? "&" : "?"}v=${imageCacheBust}` : url);

  useEffect(() => {
    if (expandedCategory === category.id) {
      setLoadingItems(true);
      loadItems(category.id).then((its) => {
        setItems(its);
        setLoadingItems(false);
      });
    }
  }, [expandedCategory, category.id, loadItems, refreshTrigger]);

  useEffect(() => {
    if (shouldFocusNewItem && newItemNameInputRef.current) {
      // Focus without forcing the entire page to scroll
      if (typeof newItemNameInputRef.current.focus === "function") {
        try {
          newItemNameInputRef.current.focus({ preventScroll: true });
        } catch {
          newItemNameInputRef.current.focus();
        }
      }
      setShouldFocusNewItem(false);
    }
  }, [shouldFocusNewItem]);

  const isExpanded = expandedCategory === category.id;
  const isEditingCategory = editing === `cat-${category.id}`;
  const editCatData = formData[`edit-cat-${category.id}`] ?? category;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("application/json")) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json") || "{}");
      if (data.itemId && data.categoryId && data.categoryId !== category.id && onMoveItem) {
        onMoveItem(data.itemId, data.categoryId, category.id);
      } else if (data.type === "category" && data.categoryId && data.categoryId !== category.id && onMoveCategory) {
        const newParentId = parentCategory ? parentCategory.id : category.id;
        onMoveCategory(data.categoryId, newParentId, undefined);
      }
    } catch (_) {}
  };

  const handleItemDragStart = (e, item) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ itemId: item.id, categoryId: category.id }));
    e.dataTransfer.effectAllowed = "move";
    setDraggingItemId(item.id);
  };

  const handleItemDragEnd = () => {
    setDraggingItemId(null);
  };

  const handleCategoryDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/json", JSON.stringify({ type: "category", categoryId: category.id }));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isDragOver
          ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-900/20"
          : "owner-card border-owner-border bg-owner-card"
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isEditingCategory ? (
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
          <div className="space-y-3">
            {(editCatData._imageFile || category.image_url) && (
              <div className="flex items-center gap-3">
                <img
                  src={
                    editCatData._imageFile
                      ? URL.createObjectURL(editCatData._imageFile)
                      : imageUrl(category.image_url)
                  }
                  alt={category.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <span className="text-sm text-zinc-500">
                  {editCatData._imageFile ? "New image (preview)" : "Current image"}
                </span>
              </div>
            )}
            <input
              type="text"
              placeholder="Category name"
              value={editCatData.name ?? category.name ?? ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  [`edit-cat-${category.id}`]: { ...(p[`edit-cat-${category.id}`] ?? category), name: e.target.value },
                }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={editCatData.description ?? category.description ?? ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  [`edit-cat-${category.id}`]: { ...(p[`edit-cat-${category.id}`] ?? category), description: e.target.value },
                }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div>
              <label className="block text-sm md:text-xs font-medium text-zinc-700 dark:text-zinc-300">Parent category</label>
              <select
                value={editCatData.parent_id ?? category.parent_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData((p) => ({
                    ...p,
                    [`edit-cat-${category.id}`]: { ...(p[`edit-cat-${category.id}`] ?? category), parent_id: v ? Number(v) : null },
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Main category (top-level)</option>
                {(mainCategories || []).filter((m) => m.id !== category.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm md:text-xs font-medium text-zinc-700 dark:text-zinc-300">Sort order</label>
              <input
                type="number"
                min="0"
                value={editCatData.sort_order ?? category.sort_order ?? 0}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    [`edit-cat-${category.id}`]: { ...(p[`edit-cat-${category.id}`] ?? category), sort_order: Number(e.target.value) || 0 },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <ImageUploadDropzone
              id={`edit-cat-img-${category.id}`}
              label="Change image"
              value={editCatData._imageFile}
              onChange={(file) =>
                setFormData((p) => ({
                  ...p,
                  [`edit-cat-${category.id}`]: { ...(p[`edit-cat-${category.id}`] ?? category), _imageFile: file ?? undefined },
                }))
              }
              onError={onImageError}
              className="mt-1"
              maxBytes={MAX_MENU_IMAGE_BYTES}
              accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
              dropHint="Drop image or click (max 2 MB). JPEG, PNG, JPG, GIF, SVG."
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onUpdateCategory(category, editCatData._imageFile)}
                className="touch-manipulation min-h-[48px] rounded-xl bg-emerald-600 px-4 py-3 text-base md:text-sm font-medium text-white"
              >
                Save
              </button>
              <button type="button" onClick={() => setEditing(null)} className="touch-manipulation min-h-[48px] rounded-xl px-4 py-3 text-base md:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
        ) : (
        <div
          draggable
          onDragStart={handleCategoryDragStart}
          className="flex min-h-[44px] cursor-grab items-center justify-between gap-2 px-3 py-2 active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
            className="touch-manipulation flex min-w-0 flex-1 items-center gap-3 text-left text-sm font-medium text-zinc-100 dark:text-zinc-200"
          >
            <span className="text-xs text-zinc-300">{isExpanded ? "▼" : "▶"}</span>
            {category.image_url && (
              <img src={imageUrl(category.image_url)} alt={category.name} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            )}
            <span className="min-w-0 truncate">{category.name}</span>
          </button>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setEditing(`cat-${category.id}`)}
              className="touch-manipulation min-h-[36px] min-w-[36px] rounded-lg px-2 py-1 text-xs font-medium text-zinc-300 hover:text-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Edit
            </button>
            {onDeleteCategory && (
              <button
                type="button"
                onClick={() => onDeleteCategory(category.id)}
                className="touch-manipulation min-h-[36px] min-w-[36px] rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
      {isExpanded && (
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
          {loadingItems ? (
            <p className="mb-4 text-xs text-zinc-500">Loading items...</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                Drag items to another category to move them.
              </p>
              <ul className="mb-4 space-y-3">
              {items.map((item) => {
                const editData = formData[`edit-item-${item.id}`] ?? item;
                return (
                  <li
                    key={item.id}
                    draggable={editing !== `item-${item.id}`}
                    onDragStart={editing !== `item-${item.id}` ? (e) => handleItemDragStart(e, item) : undefined}
                    onDragEnd={editing !== `item-${item.id}` ? handleItemDragEnd : undefined}
                    className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900 ${
                      editing !== `item-${item.id}` ? "cursor-grab active:cursor-grabbing" : ""
                    } ${draggingItemId === item.id ? "opacity-50" : ""}`}
                  >
                    {editing === `item-${item.id}` ? (
                      <div className="space-y-3">
                        {(editData._imageFile || item.image_url) && (
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                editData._imageFile
                                  ? URL.createObjectURL(editData._imageFile)
                                  : imageUrl(item.image_url)
                              }
                              alt={item.name}
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                            <span className="text-sm text-zinc-500">
                              {editData._imageFile ? "New image (preview)" : "Current image"}
                            </span>
                          </div>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            type="text"
                            value={editData.name ?? item.name}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), name: e.target.value },
                              }))
                            }
                            placeholder="Name"
                            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={editData.price ?? item.price ?? ""}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), price: e.target.value },
                              }))
                            }
                            placeholder="Price"
                            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                        <textarea
                          value={editData.description ?? item.description ?? ""}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), description: e.target.value },
                            }))
                          }
                          placeholder="Description"
                          rows={3}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm md:text-xs leading-relaxed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <ImageUploadDropzone
                          id={`edit-item-image-${item.id}`}
                          label="Change image"
                          value={editData._imageFile}
                          onChange={(file) =>
                            setFormData((p) => ({
                              ...p,
                              [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), _imageFile: file ?? undefined },
                            }))
                          }
                          onError={onImageError}
                          className="mt-1"
                          maxBytes={MAX_MENU_IMAGE_BYTES}
                          accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
                          dropHint="Drop image or click (max 2 MB). JPEG, PNG, JPG, GIF, SVG."
                        />
                        <div className="flex flex-wrap gap-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.is_gluten_free === true}
                              onChange={(e) =>
                                setFormData((p) => ({
                                  ...p,
                                  [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), is_gluten_free: e.target.checked },
                                }))
                              }
                              className="rounded border-zinc-300"
                            />
                            <span className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">Gluten-free</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.is_vegan === true}
                              onChange={(e) =>
                                setFormData((p) => ({
                                  ...p,
                                  [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), is_vegan: e.target.checked },
                                }))
                              }
                              className="rounded border-zinc-300"
                            />
                            <span className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">Vegan</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editData.is_vegetarian === true}
                              onChange={(e) =>
                                setFormData((p) => ({
                                  ...p,
                                  [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), is_vegetarian: e.target.checked },
                                }))
                              }
                              className="rounded border-zinc-300"
                            />
                            <span className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">Vegetarian</span>
                          </label>
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editData.is_available !== false}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                [`edit-item-${item.id}`]: { ...(p[`edit-item-${item.id}`] ?? item), is_available: e.target.checked },
                              }))
                            }
                            className="rounded border-zinc-300"
                          />
                          <span className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">Available</span>
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateItem(item)}
                            className="touch-manipulation min-h-[48px] rounded-xl bg-emerald-600 px-4 py-3 text-base md:text-sm font-medium text-white"
                          >
                            Save
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="touch-manipulation min-h-[48px] rounded-xl px-4 py-3 text-base md:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Left: image + text */}
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                            {item.image_url ? (
                              <img
                                src={imageUrl(item.image_url)}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-200">
                                {item.name?.charAt(0)?.toUpperCase() || "I"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-100 dark:text-zinc-100 truncate">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="mt-0.5 text-sm text-zinc-300 dark:text-zinc-400 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {item.is_gluten_free && (
                                <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-900 dark:bg-zinc-600">
                                  Gluten-free
                                </span>
                              )}
                              {item.is_vegan && (
                                <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-900 dark:bg-zinc-600">
                                  Vegan
                                </span>
                              )}
                              {item.is_vegetarian && (
                                <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-900 dark:bg-zinc-600">
                                  Vegetarian
                                </span>
                              )}
                              {item.is_available === false && (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                  Unavailable
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: price + actions */}
                        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                          <p className="text-base md:text-sm font-semibold text-zinc-100 dark:text-zinc-100">
                            {typeof item.price === "number"
                              ? item.price.toFixed(2)
                              : item.price}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((p) => ({
                                  ...p,
                                  [`edit-item-${item.id}`]: {
                                    name: item.name,
                                    description: item.description ?? "",
                                    price: item.price,
                                    is_available: item.is_available !== false,
                                    is_gluten_free: !!item.is_gluten_free,
                                    is_vegan: !!item.is_vegan,
                                    is_vegetarian: !!item.is_vegetarian,
                                    _imageFile: undefined,
                                  },
                                }));
                                setEditing(`item-${item.id}`);
                              }}
                              className="touch-manipulation min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 dark:text-zinc-400"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteItem(item.id)}
                              className="touch-manipulation min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              </ul>
            </>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await onCreateItem(category.id, e);
                const list = await loadItems(category.id);
                setItems(list);
                setShouldFocusNewItem(true);
              } catch (_) {
                // Validation or API error already handled by parent
              }
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Item name *"
                required
                ref={newItemNameInputRef}
                value={formData[`item-${category.id}`]?.name || ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), name: e.target.value },
                  }))
                }
                className="min-w-[140px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base md:text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Price *"
                required
                value={formData[`item-${category.id}`]?.price ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), price: e.target.value },
                  }))
                }
                className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-base md:text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <textarea
              placeholder="Description (optional)"
              value={formData[`item-${category.id}`]?.description || ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), description: e.target.value },
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm md:text-xs leading-relaxed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <ImageUploadDropzone
              id={`item-img-${category.id}`}
              label="Image (optional)"
              value={formData[`item-${category.id}`]?._imageFile}
              onChange={(file) =>
                setFormData((p) => ({
                  ...p,
                  [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), _imageFile: file ?? undefined },
                }))
              }
              onError={onImageError}
              className="mt-1"
              maxBytes={MAX_MENU_IMAGE_BYTES}
              accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
              dropHint="Drop image or click (max 2 MB). JPEG, PNG, JPG, GIF, SVG."
            />
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData[`item-${category.id}`]?.is_gluten_free === true}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), is_gluten_free: e.target.checked },
                    }))
                  }
                  className="rounded border-zinc-300"
                />
                <span className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">Gluten-free</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData[`item-${category.id}`]?.is_vegan === true}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), is_vegan: e.target.checked },
                    }))
                  }
                  className="rounded border-zinc-300"
                />
                <span className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">Vegan</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData[`item-${category.id}`]?.is_vegetarian === true}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), is_vegetarian: e.target.checked },
                    }))
                  }
                  className="rounded border-zinc-300"
                />
                <span className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">Vegetarian</span>
              </label>
            </div>
            <button type="submit" className="touch-manipulation min-h-[48px] w-full rounded-xl bg-zinc-600 px-4 py-3 text-base md:text-sm font-medium text-white dark:bg-zinc-500 sm:w-auto">
              Add Item
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
