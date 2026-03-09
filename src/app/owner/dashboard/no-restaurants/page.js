"use client";

import Link from "next/link";

export default function NoRestaurantsPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        No restaurants found
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        Your account is not associated with any restaurant yet. Please contact support to get set up.
      </p>
      <Link
        href="/"
        className="inline-block rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Back to site
      </Link>
    </div>
  );
}
