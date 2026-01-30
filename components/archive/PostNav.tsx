'use client';

import { prefetchArchiveEntryData, prefetchArchiveIndex } from "@/lib/archive";
import { ForesightPrefetchLink } from "../ui/ForesightPrefetchLink";
import { useEffect, useState } from "react";
import { getHistoryState } from "@/lib/urlState";
import { useRouter } from "next/navigation";

type Props = {
  doRealPrefetch: boolean;
}

export function PostNav({ doRealPrefetch }: Props) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);


  let backText = "← Back to archives";
  const state = hydrated ? getHistoryState() : null;
  if (state && state.lastPostCode) {
    backText = `← Back to ${state.lastPostCode}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
      <ForesightPrefetchLink
        href="/archives"
        className="rounded-full border px-3 py-1 text-sm transition hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-900"
        onClick={(event) => {
          event.preventDefault();
          if (!state) {
            router.push("/archives");
            return;
          }

          const backCount = state.backCount || 1;
          if (backCount > 1) {
            window.history.go(-backCount);
          } else {
            window.history.back();
          }
        }}
        beforePrefetch={(e) => {
          if (!state || !state.lastPostCode) {
            prefetchArchiveIndex();
            return;
          }

          // prefetch post
          (async () => {
            const index = await prefetchArchiveIndex();
            if (!index) return;
            const post = index.posts.find((p) => p.entry.codes.includes(state.lastPostCode!));
            if (post) {
              await prefetchArchiveEntryData(post);
            }
          })();

          if (!doRealPrefetch) {
            e.cancel();
          }
        }}
      >
        {backText}
      </ForesightPrefetchLink>
      <ForesightPrefetchLink
        href="/archives"
        className="text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        onClick={(event) => {
          event.preventDefault();
          router.push("/archives");
        }}
        beforePrefetch={() => prefetchArchiveIndex()}
      >
        Archive home
      </ForesightPrefetchLink>
    </div>
  );
}
