'use client';

import Link from "next/link";

export function PostNav() {
  const handleBack = () => {
     if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.replace('/archives');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
      <button
        className="rounded-full border px-3 py-1 text-sm transition hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-900"
        onClick={handleBack}
      >
        ← Back
      </button>
      <Link
        href="/archives"
        className="text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        prefetch={false}
      >
        Archive home
      </Link>
    </div>
  );
}
