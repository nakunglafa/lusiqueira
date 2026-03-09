"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getMyRestaurants } from "@/lib/api";
import { toArray } from "@/lib/owner-utils";

export default function OwnerSelectRestaurantPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getMyRestaurants(token)
      .then((res) => setRestaurants(toArray(res)))
      .catch(() => setRestaurants([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (restaurants.length === 0) {
    router.replace("/owner/dashboard/no-restaurants");
    return null;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Select a restaurant
      </h1>
      <ul className="space-y-3">
        {restaurants.map((r) => (
          <li key={r.id}>
            <Link
              href={`/owner/dashboard/${r.id}`}
              className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {r.name}
              </span>
              {r.address && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {r.address}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
