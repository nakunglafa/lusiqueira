# Push Notifications Troubleshooting Guide

This guide helps you debug real-time reservation/order notifications for restaurant owners.

## Owner Dashboard Checklist

| Item | Value |
|------|-------|
| API URL | `https://restaurant.digitallisbon.pt` (base) or `https://restaurant.digitallisbon.pt/api` |
| Auth endpoint | `{API_URL}/broadcasting/auth` → `https://restaurant.digitallisbon.pt/api/broadcasting/auth` |
| Pusher key | Same as backend `PUSHER_APP_KEY` |
| restaurantIds | From `GET /api/owner/my-restaurants` |
| Token | Bearer token from login, sent in `Authorization` header to auth endpoint |

## Channels Subscribed

- **User channel** `private-App.Models.User.{userId}` — NewReservationNotification, OrderCreated
- **Restaurant channels** `private-restaurant.{id}` — ReservationCreated, ReservationUpdated, OrderCreated (per restaurant)

## Frontend Checklist

### 1. Environment variables (`.env.local`)

Ensure these are set and **restart the dev server** after changes:

```
NEXT_PUBLIC_PUSHER_APP_KEY=da6b5f762a150f1ef70e
NEXT_PUBLIC_PUSHER_APP_CLUSTER=eu
NEXT_PUBLIC_API_URL=https://restaurant.digitallisbon.pt/api
```

Optional override for auth URL:
```
NEXT_PUBLIC_BROADCASTING_AUTH_URL=https://restaurant.digitallisbon.pt/api/broadcasting/auth
```

### 2. User role

Notifications only run for **owners** and **super-admins**. Log in with an owner/super-admin account.

### 3. Browser console (development)

With `npm run dev`, open DevTools (F12) → Console. You should see:

- `[Echo] Created successfully. Auth endpoint: https://restaurant.digitallisbon.pt/api/broadcasting/auth`
- `[Notifications] Subscribed to user channel: private-App.Models.User.{yourUserId}`
- `[Notifications] Subscribed to restaurant channel: restaurant.{id}` (for each owned restaurant)

If you see:

- `[Echo] Push notifications disabled: NEXT_PUBLIC_PUSHER_APP_KEY is not set` → Add the key and restart.
- `[Notifications] User is not owner/super-admin, skipping` → Log in with an owner account.
- `[Notifications] Subscription failed` → See backend checklist below.
- `[Notifications] Echo not created` → Check Pusher key and that `laravel-echo` + `pusher-js` are installed.

---

## Backend Checklist (Laravel)

The backend at `https://restaurant.digitallisbon.pt` must be configured correctly.

### 1. `.env` on the server

```env
BROADCAST_DRIVER=pusher

PUSHER_APP_ID=your_app_id
PUSHER_APP_KEY=da6b5f762a150f1ef70e
PUSHER_APP_SECRET=your_secret
PUSHER_APP_CLUSTER=eu
```

The `PUSHER_APP_KEY` must match `NEXT_PUBLIC_PUSHER_APP_KEY` in the frontend.

### 2. Broadcasting auth route

Laravel must expose `/api/broadcasting/auth`. Check `routes/channels.php`:

```php
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('restaurant.{id}', function ($user, $restaurantId) {
    // Allow owner or super-admin
    return $user->restaurants->contains($restaurantId) || $user->isSuperAdmin();
});
```

### 3. CORS

The frontend (e.g. `http://localhost:3000`) must be allowed to call `POST https://restaurant.digitallisbon.pt/api/broadcasting/auth`. Configure CORS in Laravel (`config/cors.php` or middleware) to allow your frontend origin.

### 4. Notification broadcasting

The `NewReservationNotification` (or equivalent) must implement `ShouldBroadcast` and use the `database` + `broadcast` channels. It should notify the restaurant owner and super-admins on `App.Models.User.{userId}`.

### 5. Queue (optional)

If you use queues, ensure a worker is running: `php artisan queue:work`. Some setups broadcast synchronously without a queue.

---

## Quick Test

1. Log in as **owner** on the frontend.
2. Open the browser console.
3. Confirm you see `[Notifications] Subscribed successfully`.
4. In another browser/incognito, create a reservation as a customer.
5. The owner’s tab should show a toast and `[Notifications] New reservation received` in the console.

---

## Common Issues

| Symptom | Likely cause |
|--------|---------------|
| No console logs at all | Not logged in as owner, or `isOwner()` returns false |
| "Subscription failed" | Backend auth failing (401/403), CORS, or wrong Pusher credentials |
| "Echo not created" | Missing `NEXT_PUBLIC_PUSHER_APP_KEY` or npm packages |
| Subscribed but no toasts | Backend not broadcasting; check Laravel logs and `BROADCAST_DRIVER` |
