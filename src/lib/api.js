/**
 * Restaurant API client.
 * Base URL: NEXT_PUBLIC_API_URL (e.g. https://restaurant.digitallisbon.pt/api)
 * Use getToken() from AuthContext for protected routes.
 */

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "";
  }
  return process.env.NEXT_PUBLIC_API_URL || "";
};

/**
 * @param {string} [token] - Bearer token for authenticated requests
 * @returns {Headers}
 */
const defaultHeaders = (token) => {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

/** Event dispatched when API returns 401 — AuthContext listens and clears session */
export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

/**
 * @param {Response} res
 * @returns {Promise<unknown>}
 */
async function parseResponse(res) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    }
    const err = new Error(data?.message || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * @param {string} path - Path relative to /api (e.g. '/restaurants')
 * @param {RequestInit & { token?: string }} [options]
 */
export async function apiFetch(path, options = {}) {
  const { token, ...fetchOptions } = options;
  const url = `${getBaseUrl().replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const isFormData = fetchOptions.body instanceof FormData;
  const headers = {
    ...defaultHeaders(token),
    ...(fetchOptions.headers || {}),
  };
  if (isFormData) delete headers["Content-Type"];
  const res = await fetch(url, {
    ...fetchOptions,
    headers,
  });
  return parseResponse(res);
}

// ——— Public (no auth) ———

export async function register(body) {
  return apiFetch("/register", { method: "POST", body: JSON.stringify(body) });
}

export async function login(body) {
  return apiFetch("/login", { method: "POST", body: JSON.stringify(body) });
}

export async function authGoogle(body) {
  return apiFetch("/auth/google", { method: "POST", body: JSON.stringify(body) });
}

export async function getRestaurants(params = {}) {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/restaurants${q ? `?${q}` : ""}`);
}

export async function getRestaurant(id) {
  return apiFetch(`/restaurants/${id}/website`);
}

export async function getRestaurantReviews(id) {
  return apiFetch(`/restaurants/${id}/reviews`);
}

/**
 * Get available reservation time slots for a date and party size.
 * GET /restaurants/{id}/availability?date=Y-m-d&party_size=N
 * Returns { available_slots: string[] } (e.g. ["12:00", "12:30", "13:00"])
 */
export async function getAvailability(restaurantId, params) {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/restaurants/${restaurantId}/availability${q ? `?${q}` : ""}`);
}

// ——— Authenticated (pass token) ———

export async function logout(token) {
  return apiFetch("/logout", { method: "POST", token });
}

export async function getCurrentUser(token) {
  return apiFetch("/user", { token });
}

export async function getProfile(token) {
  return apiFetch("/profile", { token });
}

export async function updateProfile(token, body) {
  return apiFetch("/profile", { method: "PUT", body: JSON.stringify(body), token });
}

export async function getOrders(token) {
  return apiFetch("/orders", { token });
}

export async function getOrder(token, id) {
  return apiFetch(`/orders/${id}`, { token });
}

export async function getReservations(token) {
  return apiFetch("/reservations", { token });
}

/**
 * Create a reservation. Auth optional.
 * Guests: send customer_name and at least one of confirmation_phone or customer_email.
 * @param {string} [token] - Optional; omit for guest booking.
 */
export async function createReservation(token, body) {
  return apiFetch("/reservations", { method: "POST", body: JSON.stringify(body), token });
}

/**
 * Get payment config for owner.
 * GET /owner/restaurants/{id}/payment-config
 */
export async function getRestaurantPaymentConfig(token, restaurantId) {
  return apiFetch(`/owner/restaurants/${restaurantId}/payment-config`, { token });
}

/**
 * Update payment config for owner.
 * PUT /owner/restaurants/{id}/payment-config
 * Body: { stripe_enabled, pickup_enabled, stripe_publishable_key? }
 */
export async function updateRestaurantPaymentConfig(token, restaurantId, data) {
  return apiFetch(`/owner/restaurants/${restaurantId}/payment-config`, {
    method: "PUT",
    body: JSON.stringify(data),
    token,
  });
}

export async function getNotifications(token) {
  return apiFetch("/notifications", { token });
}

export async function getUnreadNotifications(token) {
  return apiFetch("/notifications/unread", { token });
}

export async function markNotificationRead(token, id) {
  return apiFetch(`/notifications/${id}/read`, { method: "PATCH", token });
}

export async function markAllNotificationsRead(token) {
  return apiFetch("/notifications/mark-all-read", { method: "POST", token });
}

// ——— Owner ———

export async function getMyRestaurants(token) {
  return apiFetch("/owner/my-restaurants", { token });
}

export async function getRestaurantById(id, token, cacheBust = false) {
  const q = cacheBust ? `?_t=${Date.now()}` : "";
  return apiFetch(`/restaurants/${id}${q}`, { token });
}

export async function updateRestaurant(id, data, token) {
  const isFormData = data instanceof FormData;
  // PHP does not populate $_FILES for PUT requests; use POST with _method=PUT for file uploads
  const method = isFormData ? "POST" : "PUT";
  const options = {
    method,
    token,
    body: isFormData ? data : JSON.stringify(data),
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  };
  if (isFormData) delete options.headers;
  return apiFetch(`/restaurants/${id}`, options);
}

/**
 * Update restaurant (owner context). Tries PUT /restaurants/{id} first (per API doc),
 * falls back to /owner/restaurants/{id} if that returns 404/405.
 * For FormData (file uploads), uses POST with _method=PUT so PHP receives the file.
 */
export async function updateOwnerRestaurant(id, data, token) {
  const isFormData = data instanceof FormData;
  const method = isFormData ? "POST" : "PUT";
  const options = {
    method,
    token,
    body: isFormData ? data : JSON.stringify(data),
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  };
  if (isFormData) delete options.headers;
  try {
    return await apiFetch(`/restaurants/${id}`, options);
  } catch (err) {
    if (err?.status === 404 || err?.status === 405) {
      return apiFetch(`/owner/restaurants/${id}`, options);
    }
    throw err;
  }
}

// Orders
export async function getRestaurantOrders(token, restaurantId, status, cacheBust = false) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (cacheBust) params.set("_t", String(Date.now()));
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/owner/restaurants/${restaurantId}/orders${q}`, { token });
}

export async function updateOrderStatus(token, restaurantId, orderId, newStatus) {
  return apiFetch(
    `/owner/restaurants/${restaurantId}/orders/${orderId}/status`,
    { method: "PATCH", body: JSON.stringify({ status: newStatus }), token }
  );
}

// Menus
export async function getMenusForRestaurant(token, restaurantId) {
  return apiFetch(`/owner/restaurants/${restaurantId}/menus`, { token });
}

export async function createMenuForRestaurant(token, restaurantId, menuData) {
  return apiFetch(`/owner/restaurants/${restaurantId}/menus`, {
    method: "POST",
    body: JSON.stringify(menuData),
    token,
  });
}

export async function getMenuById(token, menuId) {
  return apiFetch(`/owner/menus/${menuId}`, { token });
}

export async function updateMenu(token, menuId, menuData) {
  return apiFetch(`/owner/menus/${menuId}`, {
    method: "PATCH",
    body: JSON.stringify(menuData),
    token,
  });
}

export async function deleteMenu(token, menuId) {
  return apiFetch(`/owner/menus/${menuId}`, { method: "DELETE", token });
}

// Categories
export async function getCategoriesForMenu(token, menuId) {
  return apiFetch(`/owner/menus/${menuId}/categories`, { token });
}

export async function createCategoryForMenu(token, menuId, categoryData) {
  const isFormData = categoryData instanceof FormData;
  const options = {
    method: "POST",
    token,
    body: isFormData ? categoryData : JSON.stringify(categoryData),
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  };
  if (isFormData) delete options.headers;
  return apiFetch(`/owner/menus/${menuId}/categories`, options);
}

export async function getCategoryById(token, categoryId) {
  return apiFetch(`/owner/categories/${categoryId}`, { token });
}

export async function updateCategory(token, categoryId, categoryData) {
  const isFormData = categoryData instanceof FormData;
  // POST required for FormData so PHP populates $_FILES (PATCH does not). FormData includes _method=PATCH for Laravel.
  // Backend must: 1) Accept POST on this route (e.g. Route::match(['post','patch'], ...)) 2) Handle $request->file('image')
  const method = isFormData ? "POST" : "PATCH";
  const options = {
    method,
    token,
    body: isFormData ? categoryData : JSON.stringify(categoryData),
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  };
  if (isFormData) delete options.headers;
  return apiFetch(`/owner/categories/${categoryId}`, options);
}

export async function deleteCategory(token, categoryId) {
  return apiFetch(`/owner/categories/${categoryId}`, { method: "DELETE", token });
}

// Items
export async function getItemsForCategory(token, categoryId) {
  return apiFetch(`/owner/categories/${categoryId}/items`, { token });
}

export async function createItemForCategory(token, categoryId, itemData) {
  const isFormData = itemData instanceof FormData;
  const options = {
    method: "POST",
    token,
    body: isFormData ? itemData : JSON.stringify(itemData),
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  };
  if (isFormData) delete options.headers;
  return apiFetch(`/owner/categories/${categoryId}/items`, options);
}

export async function getItemById(token, itemId) {
  return apiFetch(`/owner/items/${itemId}`, { token });
}

export async function updateItem(token, itemId, itemData) {
  const isFormData = itemData instanceof FormData;
  // POST required for FormData so server populates $_FILES; FormData includes _method=PATCH for Laravel
  const method = isFormData ? "POST" : "PATCH";
  const options = {
    method,
    token,
    body: isFormData ? itemData : JSON.stringify(itemData),
    headers: isFormData ? {} : { "Content-Type": "application/json" },
  };
  if (isFormData) delete options.headers;
  return apiFetch(`/owner/items/${itemId}`, options);
}

export async function deleteItem(token, itemId) {
  return apiFetch(`/owner/items/${itemId}`, { method: "DELETE", token });
}

// Tables
export async function getRestaurantTables(token, restaurantId) {
  return apiFetch(`/owner/restaurants/${restaurantId}/tables`, { token });
}

export async function createRestaurantTable(token, restaurantId, tableData) {
  return apiFetch(`/owner/restaurants/${restaurantId}/tables`, {
    method: "POST",
    body: JSON.stringify(tableData),
    token,
  });
}

export async function createRestaurantTablesBulk(token, restaurantId, bulkData) {
  return apiFetch(`/owner/restaurants/${restaurantId}/tables/bulk`, {
    method: "POST",
    body: JSON.stringify(bulkData),
    token,
  });
}

export async function updateRestaurantTable(token, tableId, tableData) {
  return apiFetch(`/owner/tables/${tableId}`, {
    method: "PATCH",
    body: JSON.stringify(tableData),
    token,
  });
}

export async function deleteRestaurantTable(token, tableId) {
  return apiFetch(`/owner/tables/${tableId}`, { method: "DELETE", token });
}

// Reservations
export async function getOwnerRestaurantReservations(token, restaurantId) {
  return apiFetch(`/owner/restaurants/${restaurantId}/reservations`, { token });
}

export async function getOwnerReservation(token, restaurantId, reservationId) {
  return apiFetch(
    `/owner/restaurants/${restaurantId}/reservations/${reservationId}`,
    { token }
  );
}

export async function updateReservationStatus(token, restaurantId, reservationId, status) {
  return apiFetch(
    `/owner/restaurants/${restaurantId}/reservations/${reservationId}/status`,
    { method: "PATCH", body: JSON.stringify({ status }), token }
  );
}

// Reservation config & opening hours
export async function getRestaurantConfig(token, restaurantId) {
  return apiFetch(`/owner/restaurants/${restaurantId}/reservation-config`, {
    token,
  });
}

export async function updateRestaurantConfig(token, restaurantId, configData) {
  return apiFetch(`/owner/restaurants/${restaurantId}/reservation-config`, {
    method: "PUT",
    body: JSON.stringify(configData),
    token,
  });
}

export async function updateOpeningSlots(token, restaurantId, slotsData) {
  return apiFetch(`/owner/restaurants/${restaurantId}/opening-slots`, {
    method: "PUT",
    body: JSON.stringify(slotsData),
    token,
  });
}

// Orders (client — create order & Stripe payment)
/**
 * Create an order. POST /orders. Auth optional.
 * Guests: send customer_name and at least one of customer_phone or customer_email.
 * @param {string} [token] - Optional; omit for guest checkout.
 */
export async function createOrder(token, body) {
  return apiFetch("/orders", { method: "POST", body: JSON.stringify(body), token });
}

/**
 * Create Stripe PaymentIntent. POST /orders/create-payment-intent. Auth optional.
 * @param {string} [token] - Optional; omit for guest checkout.
 */
export async function createPaymentIntent(token, body) {
  return apiFetch("/orders/create-payment-intent", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });
}

/** Public: get payment options for a restaurant (stripe, pickup). Falls back to both enabled if API fails. */
export async function getRestaurantPaymentOptions(restaurantId) {
  try {
    const data = await apiFetch(`/restaurants/${restaurantId}/payment-options`);
    return {
      stripe: data?.stripe_enabled ?? data?.stripe ?? true,
      pickup: data?.pickup_enabled ?? data?.pickup ?? true,
    };
  } catch {
    return { stripe: true, pickup: true };
  }
}

// ——— Admin (super admin only) ———

export async function getAdminUsers(token, params = {}) {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/admin/users${q ? `?${q}` : ""}`, { token });
}

export async function getAdminRestaurants(token) {
  return apiFetch("/admin/restaurants", { token });
}
