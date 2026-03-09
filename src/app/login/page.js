"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Header } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getMyRestaurants } from "@/lib/api";
import { isOwner } from "@/lib/owner-utils";
import { toArray } from "@/lib/owner-utils";

async function redirectAfterLogin(router, searchParams, user, token) {
  if (isOwner(user)) {
    if (token) {
      try {
        const res = await getMyRestaurants(token);
        const restaurants = toArray(res);
        if (restaurants.length > 0) {
          router.push(`/owner/dashboard/${restaurants[0].id}`);
        } else {
          router.push("/owner/dashboard");
        }
      } catch {
        router.push("/owner/dashboard");
      }
    } else {
      router.push("/owner/dashboard");
    }
  } else {
    const redirect = searchParams.get("redirect") || "/";
    router.push(redirect);
  }
  router.refresh();
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      const user = data.user ?? data;
      const token = data.access_token;
      await redirectAfterLogin(router, searchParams, user, token);
    } catch (err) {
      setError(err?.data?.message || err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleClick = () => {
    setError("");
    const redirect = searchParams.get("redirect") || "/";
    signIn("google", { callbackUrl: redirect });
  };

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-6 text-2xl font-bold text-wood-900">Log in</h1>
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="glass rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
          <button
            type="button"
            onClick={handleGoogleClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-wood-500/40 bg-white/10 px-4 py-3 font-medium text-wood-900 hover:bg-white/15 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <div className="flex items-center gap-4 before:h-px before:flex-1 before:bg-white/20 after:h-px after:flex-1 after:bg-white/20">
            <span className="text-sm font-medium text-wood-500">or</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-wood-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg border border-wood-500/40 bg-white/10 px-4 py-2 text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-wood-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-lg border border-wood-500/40 bg-white/10 px-4 py-2 text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-accent py-3 font-medium text-wood-950 hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-wood-600">
          No account? <Link href="/register" className="font-medium text-wood-900 underline hover:text-accent">Sign up</Link>
        </p>
      </main>
    </div>
  );
}
