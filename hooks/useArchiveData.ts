import { useEffect, useState } from "react";
import { ArchiveIndex, ArchiveListItem, fetchArchiveIndex } from "@/lib/archive";
import { DEFAULT_GLOBAL_TAGS } from "@/lib/types";
import { disableLiveFetch } from "@/lib/runtimeFlags";

type Options = {
  initial?: ArchiveIndex;
};

export function useArchiveData({ initial }: Options = {}) {
  const [config, setConfig] = useState(initial?.config ?? null);
  const [channels, setChannels] = useState(initial?.channels ?? []);
  const [posts, setPosts] = useState<ArchiveListItem[]>(initial?.posts ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disableLiveFetch) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function run() {
      if (initial) {
        // Always try to refresh to capture brand-new posts when user lands.
        setLoading(true);
      }
      try {
        const idx = await fetchArchiveIndex();
        if (cancelled) return;
        const mergedConfig = {
          ...idx.config,
          globalTags: initial?.config?.globalTags?.length
            ? initial.config.globalTags
            : idx.config.globalTags || DEFAULT_GLOBAL_TAGS,
        };
        setConfig(mergedConfig);
        setChannels(idx.channels);
        setPosts(idx.posts);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!initial) run();
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
