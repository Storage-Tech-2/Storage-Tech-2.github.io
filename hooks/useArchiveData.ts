import { useEffect, useRef, useState } from "react";
import { ArchiveIndex, ArchiveListItem, buildEntrySlug, fetchArchiveIndex, fetchPostData } from "@/lib/archive";
import { type EntryRef } from "@/lib/types";
import { disableLiveFetch } from "@/lib/runtimeFlags";

type Options = {
  initial?: ArchiveIndex;
};

function keyForEntry(channelPath: string, entry: EntryRef) {
  return `${channelPath}/${entry.path}`;
}

export function useArchiveData({ initial }: Options = {}) {
  const [config, setConfig] = useState(initial?.config ?? null);
  const [channels, setChannels] = useState(initial?.channels ?? []);
  const [posts, setPosts] = useState<ArchiveListItem[]>(initial?.posts ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(new Map<string, Promise<ArchiveListItem>>());

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
        setConfig(idx.config);
        setChannels(idx.channels);
        setPosts((prev) => {
          // Preserve already loaded post bodies when matching id/code.
          const loadedById = new Map(prev.map((p) => [p.entry.id, p]));
          return idx.posts.map((post) => {
            const existing = loadedById.get(post.entry.id);
            if (existing?.data) return { ...post, data: existing.data };
            return post;
          });
        });
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
      const id = setTimeout(run, 250);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const ensurePostLoaded = async (post: ArchiveListItem) => {
    if (disableLiveFetch) return post;
    if (post.data) return post;
    const cacheKey = keyForEntry(post.channel.path, post.entry);
    const existing = inflight.current.get(cacheKey);
    if (existing) return existing;
    const request = (async () => {
      const data = await fetchPostData(post.channel.path, post.entry);
      return { ...post, slug: buildEntrySlug(post.entry), data };
    })();
    inflight.current.set(cacheKey, request);
    try {
      const loaded = await request;
      setPosts((prev) =>
        prev.map((p) => (keyForEntry(p.channel.path, p.entry) === cacheKey ? { ...p, data: loaded.data } : p)),
      );
      return loaded;
    } finally {
      inflight.current.delete(cacheKey);
    }
  };

  return { config, channels, posts, loading, error, ensurePostLoaded };
}
