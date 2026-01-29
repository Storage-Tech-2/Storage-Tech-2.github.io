'use client';

import { useEffect } from "react";
import Link from "next/link";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { prefetchArchiveIndex } from "@/lib/archive";

export function PostNav() {
  const handleBack = useBackNavigation("/archives");
  useEffect(() => {
    prefetchArchiveIndex();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
      <Link
        href="/archives"
        className="rounded-full border px-3 py-1 text-sm transition hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-900"
        onClick={(event) => {
          event.preventDefault();
          handleBack();
        }}
        onMouseEnter={() => prefetchArchiveIndex()}
        onFocus={() => prefetchArchiveIndex()}
      >
        ← Back
      </Link>
      <Link
        href="/archives"
        className="text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        prefetch={false}
        onMouseEnter={() => prefetchArchiveIndex()}
        onFocus={() => prefetchArchiveIndex()}
      >
        Archive home
      </Link>
    </div>
  );
}
