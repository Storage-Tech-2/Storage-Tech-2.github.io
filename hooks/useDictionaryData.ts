import { useEffect, useRef, useState } from "react";
import { fetchDictionaryEntry, fetchDictionaryIndex } from "@/lib/archive";
import { type DictionaryEntry, type IndexedDictionaryEntry } from "@/lib/types";
import { disableLiveFetch } from "@/lib/runtimeFlags";

type Options = {
  initial?: { entries: IndexedDictionaryEntry[] };
};

export function useDictionaryData({ initial }: Options = {}) {
  const [entries, setEntries] = useState<IndexedDictionaryEntry[]>(initial?.entries ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(new Map<string, Promise<DictionaryEntry>>());

  useEffect(() => {
    if (disableLiveFetch) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function run() {
      if (initial) setLoading(true);
      try {
        const idx = await fetchDictionaryIndex();
        if (cancelled) return;
        setEntries((prev) => {
          const loaded = new Map(prev.map((e) => [e.index.id, e]));
          return idx.entries.map((entry) => {
            const existing = loaded.get(entry.index.id);
            if (existing?.data) return { ...entry, data: existing.data };
            return entry;
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

  const ensureEntryLoaded = async (entry: IndexedDictionaryEntry) => {
    if (disableLiveFetch) return entry.data;
    if (entry.data) return entry.data;
    const existing = inflight.current.get(entry.index.id);
    if (existing) return existing;
    const request = fetchDictionaryEntry(entry.index.id);
    inflight.current.set(entry.index.id, request);
    try {
      const data = await request;
      setEntries((prev) => prev.map((e) => (e.index.id === entry.index.id ? { ...e, data } : e)));
      return data;
    } finally {
      inflight.current.delete(entry.index.id);
    }
  };

  return { entries, loading, error, ensureEntryLoaded };
}
