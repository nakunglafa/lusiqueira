"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut, getSession } from "next-auth/react";
import * as api from "@/lib/api";

const AuthContext = createContext(null);

/**
 * Normalize NextAuth session to the shape expected by the app (user with id, role, etc.).
 */
function sessionToUser(session) {
  if (!session?.user) return null;
  const u = session.user;
  return {
    id: u.id ?? u.sub,
    email: u.email,
    name: u.name,
    role: u.role,
    role_id: u.role_id,
    restaurants: u.restaurants,
    ...u,
  };
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const user = sessionToUser(session);
  const token = session?.accessToken ?? null;
  const isAuthenticated = status === "authenticated" && !!user;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnauthorized = () => {
      signOut({ redirect: false });
      router.push("/login");
    };
    window.addEventListener(api.AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(api.AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [router]);

  const login = async (email, password) => {
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) throw new Error(res.error);
    const s = await getSession();
    return { user: sessionToUser(s), access_token: s?.accessToken };
  };

  const loginWithGoogle = async () => {
    const res = await signIn("google", { redirect: false, callbackUrl: "/" });
    if (res?.error) throw new Error(res.error);
    const s = await getSession();
    return { user: sessionToUser(s), access_token: s?.accessToken };
  };

  const registerUser = async (body) => {
    const data = await api.register(body);
    await signIn("credentials", {
      redirect: false,
      email: body.email,
      password: body.password,
    });
    return data;
  };

  const logout = async () => {
    if (token) {
      try {
        await api.logout(token);
      } catch (_) {}
    }
    await signOut({ redirect: false });
    router.push("/login");
  };

  const value = {
    user,
    token,
    loading,
    login,
    loginWithGoogle,
    register: registerUser,
    logout,
    isAuthenticated,
    session,
    status,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

