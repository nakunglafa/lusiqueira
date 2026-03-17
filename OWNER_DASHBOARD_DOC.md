## Owner Dashboard Documentation

### Overview

This repository contains a **Next.js (App Router) owner dashboard** for a Laravel‑based restaurant API. The owner dashboard lets restaurant owners:

- **Monitor performance**: recent revenue, orders, and bookings.
- **Manage operations** per restaurant: orders, menu, tables, reservations.
- **Configure settings**: restaurant details, opening hours, payment methods, and device behavior.

The customer‑facing site is described in `README.md`; this document focuses on the **owner dashboard** under `/owner/*`.

---

### 1. Tech Stack

- **Framework**: `next@16` (App Router, `src/app`)
- **Runtime**: React 19
- **Auth**: `next-auth@4` with:
  - Credentials provider calling the Laravel `/login` endpoint.
  - Google provider calling the Laravel `/auth/google` endpoint.
- **Styling**: Tailwind CSS 4 + custom `owner-*` utility classes (`globals.css`).
- **Real-time**: Laravel Echo + Pusher (`laravel-echo`, `pusher-js`) via notification contexts.
- **Payments**: Stripe JS (`@stripe/react-stripe-js`, `@stripe/stripe-js`) with backend integration.

Run locally:

```bash
npm install
npm run dev
```

The owner dashboard typically runs on `http://localhost:3001` (see `package.json`).

---

### 2. Environment Configuration

Set these variables in `.env.local` (or `.env` in this project):

```env
# Base URL for Laravel API (must include /api)
NEXT_PUBLIC_API_URL=https://your-backend.example.com/api

# Alternatively (used in this project):
# NEXT_PUBLIC_LARAVEL_URL=https://your-backend.example.com

# Default restaurant ID for the summary dashboard
NEXT_PUBLIC_RESTAURANT_ID=9

# NextAuth secret
NEXTAUTH_SECRET=your-random-secret

# Google OAuth (optional, but supported)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

The Laravel API must:

- Accept CORS requests from the frontend origin.
- Expose auth and restaurant resources as described below.

---

### 3. Authentication & Authorization

**NextAuth handler**: `src/app/api/auth/[...nextauth]/route.js`

- **Credentials login** hits `POST {API_URL}/login` with `{ email, password }`.
  - Expected response:
    - `access_token` – used as Bearer token.
    - `user` – includes: `id`, `email`, `name`, `role`, `role_id`, `restaurants[]`.
- **Google login** hits `POST {API_URL}/auth/google` with `{ name, email, google_id }`, returning the same structure.
- JWT callback stores:
  - `token.accessToken`
  - `token.id`, `token.role`, `token.role_id`
  - `token.restaurants`
- Session callback exposes:
  - `session.user` (id, role, role_id, restaurants)
  - `session.accessToken`

**Role check**: `src/lib/owner-utils.js`

- `isOwner(user)` returns `true` when:
  - Role slug/name looks like owner or admin (`restaurant-owner`, `super-admin`, etc.), or
  - `role_id` is `1` or `2`.

**Owner layout**: `src/app/owner/layout.js`

- Wraps all `/owner/*` pages with:
  - `AuthProvider` – exposes `{ user, token, isAuthenticated, loading, logout }`.
  - `OwnerRefreshProvider` – lets child components register a refresh callback.
- Redirects:
  - To `/login?redirect=/owner/dashboard` when unauthenticated.
  - To `/` if the user is not an owner.
- Renders a header with:
  - “Owner Dashboard” link (`/owner/dashboard`).
  - “Back to site” link (`/`).
  - User avatar dropdown (email + Sign out).

To reuse this pattern in another project, implement your own backend `/login` and `/auth/google` endpoints that match the expected response shape, then adjust `isOwner` if your roles differ.

---

### 4. API Layer & Helpers

**API client**: `src/lib/api.js` (not fully shown here) centralizes calls such as:

- `getMyRestaurants(token)`
- `getRestaurantById(id, token, includeConfig?)`
- `getRestaurantOrders(token, restaurantId, status?, cacheBust?)`
- `updateOrderStatus(token, restaurantId, orderId, status)`
- `getOwnerRestaurantReservations(token, restaurantId)`
- `updateReservationStatus(token, restaurantId, reservationId, status)`
- `getMenusForRestaurant`, `createMenuForRestaurant`, `updateMenu`, `deleteMenu`
- `getCategoriesForMenu`, `getItemsForCategory`, `createItemForCategory`, `updateItem`, `deleteItem`
- `getRestaurantConfig`, `updateRestaurantConfig`, `updateOpeningSlots`
- `getRestaurantPaymentConfig`, `updateRestaurantPaymentConfig`

All functions:

- Accept `token` and set `Authorization: Bearer {token}`.
- Expect Laravel JSON responses that may wrap collections in `data`, `restaurants`, `orders`, etc.

**Utility**: `src/lib/owner-utils.js`

- `toArray(raw)` normalizes common Laravel shapes:
  - `{ data: [...] }`
  - `{ data: { data: [...] } }`
  - `{ data: { reservations: [...] } }`
  - `{ orders: { data: [...] } }`

When adding new endpoints, keep their responses compatible with `toArray`, or update helper logic accordingly.

---

### 5. Owner Routes & Layout

Owner routes live under `src/app/owner`:

- `owner/layout.js` – shared layout and auth guard.
- `owner/dashboard/page.js` – summary dashboard (uses `NEXT_PUBLIC_RESTAURANT_ID`).
- `owner/dashboard/[restaurantId]/page.js` – main per‑restaurant dashboard.
- `owner/dashboard/no-restaurants/page.js` – shown when user has no restaurants.
- `owner/dashboard/select/page.js` – restaurant selector for multi‑restaurant owners.

#### 5.1 Summary dashboard (`/owner/dashboard`)

File: `src/app/owner/dashboard/page.js`

- Uses `useAuth` for `token` and `isAuthenticated`.
- Loads recent:
  - Orders: `getRestaurantOrders(token, RESTAURANT_ID)`
  - Reservations: `getOwnerRestaurantReservations(token, RESTAURANT_ID)`
- Displays:
  - **Sales overview** (last 5 orders total).
  - Count of recent orders and bookings.
  - Simple “sales by day” bar visualization.
- Provides “Manage restaurant” / “View all” links to `/owner/dashboard/[RESTAURANT_ID]`.

#### 5.2 Per‑restaurant dashboard (`/owner/dashboard/[restaurantId]`)

File: `src/app/owner/dashboard/[restaurantId]/page.js`

- Reads `restaurantId` from URL params.
- Guarded by `useAuth` and `OwnerLayout`:
  - Redirects to `/login` when unauthenticated.
  - Redirects to `/owner/dashboard` when there is no restaurant.
- Fetches:
  - Owner’s restaurants list.
  - Selected restaurant details.
  - Orders, tables, reservations, menus.
- Registers a refresh function with `OwnerRefreshContext` so other components or real‑time events can trigger re‑loads.
- Renders a **tabbed UI** (`TABS`):
  - `Orders` → `OrdersTab`
  - `Menu` → `MenuTab`
  - `Special menus` → `SpecialMenusTab`
  - `Tables` → `TablesTab`
  - `Reservations` → `ReservationsTab`
  - `Settings` → `SettingsTab`
- On desktop, tabs appear below the header; on mobile, as a bottom icon bar.

To add or remove features, edit the `TABS` array and the conditionals that render each tab.

---

### 6. Feature Tabs

#### 6.1 Orders (`OrdersTab`)

File: `src/components/owner/OrdersTab.js`

Responsibilities:

- Load orders for the current restaurant:
  - Either from parent prop (`orders`) or directly via `getRestaurantOrders`.
- Provide status filter chips (All, Pending, Confirmed, Preparing, etc.).
- Render order cards with:
  - ID, date/time.
  - Customer name, phone (`tel:` link), email (`mailto:` link).
  - Order type and delivery address.
  - Line items and totals.
- Allow updating order status via a `<select>`:
  - Calls `updateOrderStatus(token, restaurantId, orderId, newStatus)`.
  - Does optimistic UI update and refreshes data.

To reuse, implement matching order endpoints in your API and ensure each order has at least:

- `id`, `status`, `order_type`, `total_amount` / `total`
- `customer_*` or `user.*` fields
- `items[]` with quantities and prices

#### 6.2 Reservations (`ReservationsTab`)

File: `src/components/owner/ReservationsTab.js`

Responsibilities:

- Load reservations via `getOwnerRestaurantReservations`.
- Robustly parse dates from multiple Laravel formats:
  - `reservation_datetime`, `datetime`, `reservation_date` + `reservation_time`, etc.
- Split reservations into:
  - **Upcoming** (date today or later).
  - **History** (past 7 days, paginated).
- Provide filters:
  - Upcoming tab: sub‑tabs “All”, “Pending”, “Confirmed”.
  - History tab: pagination for past reservations.
- Allow inline status changes via `updateReservationStatus`.

Backend should provide for each reservation:

- `id`, `status`, `customer_name` / `user.name`, `party_size`
- One of the supported date/time field combinations.

#### 6.3 Menu management (`MenuTab`)

File: `src/components/owner/MenuTab.js`

Responsibilities:

- Manage **menus** per restaurant:
  - List, create, rename, delete menus.
- Manage **categories**:
  - Main categories (top‑level).
  - Sub‑categories (with `parent_id`).
  - Optional image, description, and sort order.
- Manage **items**:
  - Name, description, price.
  - Availability flags: gluten‑free, vegan, vegetarian, available/unavailable.
  - Optional image uploads.
- Support drag‑and‑drop:
  - Move items between categories.
  - Re‑parent categories.
- Use `ImageUploadDropzone` for consistent file uploads.
- Show `Toast` messages for success/error feedback.

API functions used:

- Menus: `getMenusForRestaurant`, `createMenuForRestaurant`, `updateMenu`, `deleteMenu`.
- Categories: `getCategoriesForMenu`, `createCategoryForMenu`, `updateCategory`, `deleteCategory`.
- Items: `getItemsForCategory`, `createItemForCategory`, `updateItem`, `deleteItem`.

All create/update calls accept either JSON or `FormData` (for image uploads).

#### 6.4 Settings (`SettingsTab`)

File: `src/components/owner/SettingsTab.js`

Sections:

1. **Restaurant details**
   - Fields: name, address, phone, Google Business URL, logo.
   - Logo upload via `ImageUploadDropzone`.
   - Persisted using `updateOwnerRestaurant`.
2. **Reservation rules**
   - `default_reservation_duration` (minutes).
   - `max_party_size`.
   - Buffer fields (if supported by backend).
   - Persisted via `updateRestaurantConfig`.
3. **Payment gateways**
   - `stripe_enabled`, `pickup_enabled`.
   - Persisted via `updateRestaurantPaymentConfig`.
4. **Opening hours**
   - For each weekday, one or more time slots (`open_time`, `close_time`).
   - “Copy to all days” helper.
   - Persisted via `updateOpeningSlots(token, restaurantId, { slots: [...] })`.
5. **Device**
   - “Keep screen on when dashboard is open” toggle for mobile devices.
   - Uses `useScreenWakeLock` + `localStorage` to remember preference.

#### 6.5 Tables & Special menus

Files:

- `src/components/owner/TablesTab.js`
- `src/components/owner/SpecialMenusTab.js`

They follow the same pattern:

- Fetch current data via functions in `lib/api.js`.
- Render list/controls.
- Call backend on create/update/delete and trigger `onRefresh`.

---

### 7. Real‑time Updates & Refresh

The dashboard is designed to work well with real‑time notifications:

- `RealTimeNotificationContext` listens to Laravel Echo / Pusher events like:
  - `NEW_RESERVATION`
  - `RESERVATION_UPDATED`
  - `NEW_ORDER`
- `OwnerRefreshContext` exposes `registerRefresh(fn)`:
  - Each main dashboard page registers a single “refresh my data” callback.
  - Real‑time events or manual actions can call this function to re‑load data in all relevant tabs.

If you add new real‑time events, wire them into these contexts and trigger the registered refresh.

---

### 8. How to Reuse This Dashboard for Another Project

To replicate this owner dashboard pattern for another restaurant or multi‑store project:

1. **Adapt the API layer** in `src/lib/api.js` to your backend endpoints.
2. **Ensure auth responses** from `/login` and `/auth/google` include:
   - `access_token`, `user`, and restaurant list.
3. **Update `isOwner` logic** in `src/lib/owner-utils.js` if role names/IDs differ.
4. **Adjust tab set** in `src/app/owner/dashboard/[restaurantId]/page.js` to match your feature set.
5. **Customize styling** in `globals.css` and component classes while keeping the structure.

This document, together with `README.md`, should give new developers enough context to understand and extend the owner dashboard for additional restaurants, roles, or features.

