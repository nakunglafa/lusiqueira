/**
 * Laravel Echo client for real-time notifications (Pusher).
 * Used for owner live notifications (reservations, orders).
 * Requires NEXT_PUBLIC_PUSHER_APP_KEY and NEXT_PUBLIC_PUSHER_APP_CLUSTER.
 */

/**
 * Get broadcasting auth URL.
 * Per API docs: auth endpoint is {API_URL}/api/broadcasting/auth.
 * Supports NEXT_PUBLIC_BROADCASTING_AUTH_URL override.
 */
function getBroadcastingAuthUrl() {
  const override = process.env.NEXT_PUBLIC_BROADCASTING_AUTH_URL;
  if (override) return override;
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/?$/, "");
  return `${apiUrl}/broadcasting/auth`;
}

/**
 * Create Echo instance for private channel listening.
 * Uses dynamic import so pusher-js/laravel-echo load only on the client.
 * @param {{ userId: number; token: string }} options
 * @returns {Promise<import('laravel-echo').Echo | null>}
 */
const DEBUG = typeof process !== "undefined" && process.env.NODE_ENV === "development";

export async function createEcho({ userId, token }) {
  if (typeof window === "undefined") return null;

  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER || "eu";

  if (!key) {
    if (DEBUG) console.warn("[Echo] Push notifications disabled: NEXT_PUBLIC_PUSHER_APP_KEY is not set");
    return null;
  }

  const config = {
    broadcaster: "pusher",
    key,
    cluster,
    forceTLS: true,
    authEndpoint: getBroadcastingAuthUrl(),
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  };

  const host = process.env.NEXT_PUBLIC_PUSHER_HOST;
  const port = process.env.NEXT_PUBLIC_PUSHER_PORT;
  const scheme = process.env.NEXT_PUBLIC_PUSHER_SCHEME;

  if (host) {
    config.wsHost = host;
    config.disableStats = true;
  }
  if (port) config.wsPort = parseInt(port, 10);
  if (scheme) config.encrypted = scheme === "https";

  try {
    const [PusherModule, EchoModule] = await Promise.all([
      import("pusher-js"),
      import("laravel-echo"),
    ]);
    const PusherLib = PusherModule.default;
    if (DEBUG) {
      PusherLib.logToConsole = true;
    }
    const EchoLib = EchoModule.default;
    window.Pusher = PusherLib;
    const echo = new EchoLib(config);
    if (DEBUG) {
      console.log("[Echo] Created successfully. Auth endpoint:", config.authEndpoint);
    }
    return echo;
  } catch (err) {
    if (DEBUG) {
      console.error("[Echo] Failed to create:", err?.message || err);
    }
    return null;
  }
}
