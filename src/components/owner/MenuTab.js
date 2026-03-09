"use client";

import { useState, useEffect, useCallback } from "react";
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

export function MenuTab({ restaurantId, token }) {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("error");
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});
  const [itemsRefreshTrigger, setItemsRefreshTrigger] = useState(0);
  const [categoriesRefreshTrigger, setCategoriesRefreshTrigger] = useState(0);
  const [imageCacheBust, setImageCacheBust] = useState(0);

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
        setMenus(toArray(res));
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

  const handleCreateCategory = async (menuId, e, type = "main") => {
    e.preventDefault();
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
      setExpandedMenu(menuId);
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

  if (loading) return <p className="text-owner-muted">Loading menus...</p>;

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
      <div>
        <h3 className="text-lg md:text-base font-semibold text-owner-charcoal">Menus</h3>
        <form onSubmit={handleCreateMenu} className="mt-2 flex flex-col gap-3 sm:flex-row sm:gap-2">
          <input
            type="text"
            placeholder="New menu name"
            value={formData.menuName || ""}
            onChange={(e) => setFormData((p) => ({ ...p, menuName: e.target.value }))}
            className="flex-1 rounded-xl border border-owner-border bg-owner-card px-4 py-3 text-base md:text-sm text-owner-charcoal"
          />
          <button
            type="submit"
            className="touch-manipulation min-h-[48px] rounded-xl bg-owner-action px-5 py-3 text-base md:text-sm font-medium text-white hover:opacity-90 sm:rounded-lg sm:py-2 sm:text-sm"
          >
            Add Menu
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {menus.map((menu) => (
          <MenuSection
            key={menu.id}
            menu={menu}
            token={token}
            expandedMenu={expandedMenu}
            setExpandedMenu={setExpandedMenu}
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
        ))}
      </div>

      {menus.length === 0 && (
        <p className="text-owner-muted">No menus yet. Create one above.</p>
      )}
    </div>
  );
}

function MenuSection({
  menu,
  token,
  expandedMenu,
  setExpandedMenu,
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
  const [showAddCategory, setShowAddCategory] = useState(false);

  useEffect(() => {
    if (expandedMenu === menu.id) {
      setLoadingCat(true);
      loadCategories(menu.id).then((cats) => {
        setCategories(cats);
        setLoadingCat(false);
      });
    }
  }, [expandedMenu, menu.id, loadCategories, categoriesRefreshTrigger]);

  const isExpanded = expandedMenu === menu.id;
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
            <button
              type="button"
              onClick={() => setExpandedMenu(isExpanded ? null : menu.id)}
              className="touch-manipulation min-h-[48px] flex flex-1 items-center gap-2 text-left text-base md:text-sm font-medium text-owner-charcoal"
            >
              <span className="text-owner-muted">{isExpanded ? "▼" : "▶"}</span>
              {menu.name}
            </button>
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

      {isExpanded && (
        <div className="border-t border-owner-border p-4 md:p-6 lg:p-6">
          <button
            type="button"
            onClick={() => setShowAddCategory((s) => !s)}
            className="touch-manipulation mb-3 flex min-h-[44px] items-center gap-2 rounded-xl border border-owner-border px-4 py-2.5 text-base md:text-sm font-medium text-owner-charcoal"
          >
            {showAddCategory ? "▼ Hide add category" : "▶ Add category"}
          </button>
          {showAddCategory && (
          <div className="mb-4 grid gap-6 lg:grid-cols-2 xl:gap-8">
            <div className="min-w-0 rounded-xl border border-owner-border owner-card p-5 shadow-sm">
              <h4 className="mb-3 text-sm md:text-xs font-semibold text-owner-charcoal">Main category</h4>
              <form onSubmit={(e) => onCreateCategory(menu.id, e, "main")} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Main category name *"
                  required
                  value={formData[`cat-main-${menu.id}`]?.name ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      [`cat-main-${menu.id}`]: { ...(p[`cat-main-${menu.id}`] || {}), name: e.target.value },
                    }))
                  }
                  className="rounded-xl border border-owner-border bg-owner-card px-4 py-3 text-base md:text-sm text-owner-charcoal placeholder:text-owner-muted"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={formData[`cat-main-${menu.id}`]?.description ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      [`cat-main-${menu.id}`]: { ...(p[`cat-main-${menu.id}`] || {}), description: e.target.value },
                    }))
                  }
                  className="rounded-xl border border-owner-border bg-owner-card px-4 py-3 text-base md:text-sm text-owner-charcoal placeholder:text-owner-muted"
                />
                <ImageUploadDropzone
                  id={`cat-main-img-${menu.id}`}
                  label="Image (optional)"
                  value={formData[`cat-main-${menu.id}`]?._imageFile}
                  onChange={(file) =>
                    setFormData((p) => ({
                      ...p,
                      [`cat-main-${menu.id}`]: { ...(p[`cat-main-${menu.id}`] || {}), _imageFile: file ?? undefined },
                    }))
                  }
                  onError={onImageError}
                  className="mt-1"
                  maxBytes={MAX_MENU_IMAGE_BYTES}
                  accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
                  dropHint="Drop image or click (max 2 MB). JPEG, PNG, JPG, GIF, SVG."
                />
                <button type="submit" className="touch-manipulation min-h-[48px] w-full rounded-xl bg-owner-action px-5 py-3 text-base md:text-sm font-medium text-white hover:opacity-90 sm:w-auto">
                  Add main category
                </button>
              </form>
            </div>
            {mainCategories.length > 0 && (
              <div className="min-w-0 rounded-xl border border-owner-border owner-card p-5 shadow-sm">
                <h4 className="mb-3 text-sm md:text-xs font-semibold text-owner-charcoal">Sub-category</h4>
                <form onSubmit={(e) => onCreateCategory(menu.id, e, "sub")} className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Sub-category name *"
                    required
                    value={formData[`cat-sub-${menu.id}`]?.name ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        [`cat-sub-${menu.id}`]: { ...(p[`cat-sub-${menu.id}`] || {}), name: e.target.value, parent_id: p[`cat-sub-${menu.id}`]?.parent_id ?? mainCategories[0]?.id },
                      }))
                    }
                    className="rounded-xl border border-owner-border bg-owner-card px-4 py-3 text-base md:text-sm text-owner-charcoal placeholder:text-owner-muted"
                  />
                  <div>
                    <label className="block text-sm md:text-xs font-medium text-owner-charcoal">Under main category</label>
                    <select
                      value={formData[`cat-sub-${menu.id}`]?.parent_id ?? mainCategories[0]?.id ?? ""}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          [`cat-sub-${menu.id}`]: { ...(p[`cat-sub-${menu.id}`] || {}), parent_id: e.target.value ? Number(e.target.value) : null },
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-owner-border bg-owner-card px-4 py-3 text-base md:text-sm text-owner-charcoal"
                    >
                      {mainCategories.map((mc) => (
                        <option key={mc.id} value={mc.id}>
                          {mc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={formData[`cat-sub-${menu.id}`]?.description ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        [`cat-sub-${menu.id}`]: { ...(p[`cat-sub-${menu.id}`] || {}), description: e.target.value },
                      }))
                    }
                    className="rounded-xl border border-wood-300 bg-wood-900 px-4 py-3 text-base md:text-sm text-wood-100 placeholder:text-wood-400 dark:border-wood-500 dark:bg-wood-200 dark:text-wood-600 dark:placeholder:text-wood-500"
                  />
                  <ImageUploadDropzone
                    id={`cat-sub-img-${menu.id}`}
                    label="Image (optional)"
                    value={formData[`cat-sub-${menu.id}`]?._imageFile}
                    onChange={(file) =>
                      setFormData((p) => ({
                        ...p,
                        [`cat-sub-${menu.id}`]: { ...(p[`cat-sub-${menu.id}`] || {}), _imageFile: file ?? undefined },
                      }))
                    }
                    onError={onImageError}
                    className="mt-1"
                    maxBytes={MAX_MENU_IMAGE_BYTES}
                    accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
                    dropHint="Drop image or click (max 2 MB). JPEG, PNG, JPG, GIF, SVG."
                  />
                  <button type="submit" className="touch-manipulation min-h-[48px] w-full rounded-xl bg-wood-400 px-5 py-3 text-base md:text-sm font-medium text-wood-950 hover:bg-wood-500 dark:bg-wood-500 dark:text-wood-50 dark:hover:bg-wood-400 sm:w-auto">
                    Add sub-category
                  </button>
                </form>
              </div>
            )}
          </div>
          )}

          {loadingCat ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : (
            <div className="space-y-3 lg:space-y-4">
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">Drag categories to reorder or move sub-categories.</p>
              <div className="grid gap-3 xl:grid-cols-2 xl:gap-4">
              {mainCategories.map((main) => (
                <div key={main.id} className="space-y-2">
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
                  {(main.children || getChildren(main.id)).map((sub) => (
                    <div key={sub.id} className="ml-4 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                      <CategorySection
                        category={sub}
                        parentCategory={main}
                        siblingCategories={main.children || getChildren(main.id)}
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
              ))}
              </div>
            </div>
          )}
        </div>
      )}
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
        isDragOver ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-900/20" : "border-wood-300 bg-wood-800 dark:border-wood-500 dark:bg-wood-200"
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isEditingCategory ? (
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
          <div className="space-y-3">
            {category.image_url && (
              <div className="flex items-center gap-3">
                <img src={imageUrl(category.image_url)} alt={category.name} className="h-16 w-16 rounded-lg object-cover" />
                <span className="text-sm text-zinc-500">Current image</span>
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
          className="flex min-h-[48px] cursor-grab items-center justify-between gap-2 p-4 active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
            className="touch-manipulation flex min-w-0 flex-1 items-center gap-3 text-left text-base md:text-sm font-medium text-zinc-100 dark:text-zinc-200"
          >
            {category.image_url && (
              <img src={imageUrl(category.image_url)} alt={category.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
            )}
            <span className="min-w-0 truncate">{category.name}</span>
            <span className="text-zinc-300">{isExpanded ? "▼" : "▶"}</span>
          </button>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setEditing(`cat-${category.id}`)}
              className="touch-manipulation min-h-[44px] min-w-[44px] rounded-lg px-2 py-2 text-base md:text-sm font-medium text-zinc-300 hover:text-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Edit
            </button>
            {onDeleteCategory && (
              <button
                type="button"
                onClick={() => onDeleteCategory(category.id)}
                className="touch-manipulation min-h-[44px] min-w-[44px] rounded-lg px-2 py-2 text-base md:text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
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
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">Drag items to another category to move them.</p>
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
                        {item.image_url && (
                          <div className="flex items-center gap-3">
                            <img src={imageUrl(item.image_url)} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
                            <span className="text-sm text-zinc-500">Current image</span>
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
                          rows={2}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm md:text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {item.image_url && (
                            <img src={imageUrl(item.image_url)} alt={item.name} className="h-16 w-16 rounded-lg object-cover" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-100 dark:text-zinc-100">{item.name}</p>
                            {item.description && <p className="mt-0.5 text-sm text-zinc-300 dark:text-zinc-400">{item.description}</p>}
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {item.is_gluten_free && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-900 dark:bg-zinc-600">Gluten-free</span>}
                              {item.is_vegan && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-900 dark:bg-zinc-600">Vegan</span>}
                              {item.is_vegetarian && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-900 dark:bg-zinc-600">Vegetarian</span>}
                              {item.is_available === false && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">Unavailable</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-base md:text-sm font-medium text-zinc-100 dark:text-zinc-100">{typeof item.price === "number" ? item.price.toFixed(2) : item.price}</p>
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
                            className="touch-manipulation min-h-[48px] rounded-lg px-4 py-2.5 text-base md:text-sm font-medium text-zinc-300 hover:text-zinc-100 dark:text-zinc-400"
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => onDeleteItem(item.id)} className="touch-manipulation min-h-[48px] rounded-lg px-4 py-2.5 text-base md:text-sm font-medium text-red-600 dark:text-red-400">
                            Delete
                          </button>
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
            <input
              type="text"
              placeholder="Description (optional)"
              value={formData[`item-${category.id}`]?.description || ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  [`item-${category.id}`]: { ...(p[`item-${category.id}`] || {}), description: e.target.value },
                }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base md:text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
