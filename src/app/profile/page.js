"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getProfile, updateProfile } from "@/lib/api";
import { Toast } from "@/components/Toast";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Autofill from auth user as soon as available (before profile API loads)
  useEffect(() => {
    if (user) {
      setName((prev) => (prev === "" ? (user?.name ?? "") : prev));
      setEmail((prev) => (prev === "" ? (user?.email ?? "") : prev));
      setPhone((prev) => (prev === "" ? (user?.phone ?? "") : prev));
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      router.push("/login");
      return;
    }
    if (!token) return;
    getProfile(token)
      .then((res) => {
        const data = res?.data ?? res;
        setProfile(data);
        setName(data?.name ?? user?.name ?? "");
        setEmail(data?.email ?? user?.email ?? "");
        setPhone(data?.phone ?? user?.phone ?? "");
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [token, isAuthenticated, authLoading, user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMessage(null);
    setSaving(true);
    try {
      await updateProfile(token, { name, email, ...(phone !== undefined && { phone }) });
      setSuccessMessage("Profile updated successfully!");
    } catch (err) {
      setError(err?.data?.message || err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (!isAuthenticated && !profile)) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-wood-100">
      <Header />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-wood-900">Profile</h1>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {loading && !user ? (
          <p className="text-wood-600">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="glass flex flex-col gap-4 rounded-2xl p-6 border border-white/10">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-wood-700">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-wood-500/40 bg-white/10 px-4 py-2 text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-wood-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-wood-500/40 bg-white/10 px-4 py-2 text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-wood-700">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-lg border border-wood-500/40 bg-white/10 px-4 py-2 text-wood-900 outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-accent py-3 font-medium text-wood-950 hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
        )}
        <p className="mt-4">
          <Link href="/" className="text-sm text-wood-600 underline hover:text-wood-900">Back to home</Link>
        </p>
      </main>
      <Toast
        message={successMessage}
        type="success"
        onClose={() => setSuccessMessage(null)}
        duration={4000}
      />
    </div>
  );
}
