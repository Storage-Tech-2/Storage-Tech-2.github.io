import { useEffect, useState } from "react";
import { ArchiveIndex, ArchiveListItem, ARCHIVE_CACHE_TTL_MS, fetchArchiveIndex, getCachedArchiveIndex, setCachedArchiveIndex } from "@/lib/archive";
import { DEFAULT_GLOBAL_TAGS } from "@/lib/types";
import { disableLiveFetch } from "@/lib/runtimeFlags";

type Options = {
  initial?: ArchiveIndex;
};

export function useArchiveData({ initial }: Options = {}) {
  const cached = getCachedArchiveIndex();
  const cachedIndex = cached?.index;
  const cachedUpdatedAt = cached?.updatedAt ?? 0;
  const initialUpdatedAt = initial?.config?.updatedAt ?? 0;
  const preferCached = !!cachedIndex && cachedUpdatedAt >= initialUpdatedAt;
  const bootstrapIndex = preferCached ? cachedIndex : initial;
  const bootstrapConfig = bootstrapIndex
    ? {
      ...bootstrapIndex.config,
      globalTags: initial?.config?.globalTags?.length
        ? initial.config.globalTags
        : bootstrapIndex.config.globalTags || DEFAULT_GLOBAL_TAGS,
    }
    : null;
  const [config, setConfig] = useState(bootstrapConfig);
  const [channels, setChannels] = useState(bootstrapIndex?.channels ?? []);
  const [posts, setPosts] = useState<ArchiveListItem[]>(bootstrapIndex?.posts ?? []);
  const [loading, setLoading] = useState(!bootstrapIndex);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disableLiveFetch) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const now = Date.now();
    const cachedNow = getCachedArchiveIndex();
    const cachedFresh = cachedNow ? now - cachedNow.fetchedAt < ARCHIVE_CACHE_TTL_MS : false;
    if (preferCached && cachedFresh) {
      const delay = Math.max(0, ARCHIVE_CACHE_TTL_MS - (now - (cachedNow?.fetchedAt ?? now)));
      if (delay > 0) {
        const id = setTimeout(() => {
          if (!cancelled) run();
        }, delay);
        return () => {
          cancelled = true;
          clearTimeout(id);
        };
      }
    }
    async function run() {
      if (initial) {
        // Always try to refresh to capture brand-new posts when user lands.
        setLoading((prev) => prev || !posts.length);
      }
      try {
        const idx = await fetchArchiveIndex();
        if (cancelled) return;
        setCachedArchiveIndex(idx);
        const mergedConfig = {
          ...idx.config,
          globalTags: initial?.config?.globalTags?.length
            ? initial.config.globalTags
            : idx.config.globalTags || DEFAULT_GLOBAL_TAGS,
        };
        const currentUpdatedAt = config?.updatedAt ?? 0;
        const nextUpdatedAt = mergedConfig.updatedAt ?? 0;
        const isSame =
          currentUpdatedAt === nextUpdatedAt &&
          idx.posts.length === posts.length &&
          idx.channels.length === channels.length;
        if (!isSame) {
          setConfig(mergedConfig);
          setChannels(idx.channels);
          setPosts(idx.posts);
        }
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!initial || !preferCached || !cachedFresh) run();
    else {
      // Defer refresh slightly to avoid blocking first paint.
      const id = setTimeout(run, 10);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [initial]);


  return { config, channels, posts, loading, error };
}
