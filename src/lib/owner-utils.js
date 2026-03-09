/**
 * Owner dashboard utilities.
 * Role check: backend may return role as string, object, or role_id.
 */

export function isOwner(user) {
  if (!user) return false;
  const role = user.role ?? user.role_name ?? user.role?.name;
  const roleStr =
    typeof role === "string"
      ? role.toLowerCase()
      : (role?.slug ?? role?.name ?? role?.id ?? "").toString().toLowerCase().replace(/\s+/g, "-");
  const roleId = user.role_id ?? user.role?.id;
  return (
    roleStr === "restaurant-owner" ||
    roleStr === "restaurant_owner" ||
    roleStr === "super-admin" ||
    roleStr === "super_admin" ||
    roleStr.includes("owner") ||
    roleStr.includes("admin") ||
    roleId === 2 || // common owner role_id
    roleId === 1    // common super-admin role_id
  );
}

/**
 * Normalize API response to array.
 * Laravel often returns: { data: [...] }, { data: { data: [...] } }, { data: { reservations: [...] } }
 */
export function toArray(raw) {
  const d = raw?.data ?? raw;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.restaurants)) return d.restaurants;
  if (Array.isArray(raw?.restaurants)) return raw.restaurants;
  if (Array.isArray(d?.reservations)) return d.reservations;
  if (Array.isArray(d?.orders)) return d.orders;
  if (Array.isArray(d?.menus)) return d.menus;
  if (Array.isArray(d?.tables)) return d.tables;
  if (Array.isArray(d?.categories)) return d.categories;
  if (Array.isArray(d?.items)) return d.items;
  // Paginated: { data: { orders: { data: [...] } } } or raw.orders?.data
  const orders = raw?.orders ?? d?.orders;
  if (Array.isArray(orders?.data)) return orders.data;
  return [];
}
