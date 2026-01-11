'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";

export function PostNav() {
  const router = useRouter();
  const handleBack = () => {
    if (typeof window === "undefined") return;
    const historyState = (window.history.state as { idx?: number } | null) ?? {};
    const ref = document.referrer;

    // Next tracks in-app navigation with an idx; when absent we likely landed directly.
    if ((historyState.idx ?? 0) > 0) {
      router.back();
      return;
    }

    if (ref) {
      try {
        const refUrl = new URL(ref);
        if (refUrl.origin === window.location.origin) {
          router.push(refUrl.pathname + refUrl.search + refUrl.hash);
          return;
        }
        if (window.history.length > 1) {
          router.back();
          return;
        }
      } catch {
        if (window.history.length > 1) {
          router.back();
          return;
        }
      }
    }

    router.push("/");
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
        href="/"
        className="text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        prefetch={false}
      >
        Archive home
      </Link>
    </div>
  );
}
