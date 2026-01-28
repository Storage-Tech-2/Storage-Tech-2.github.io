'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DictionaryModal } from "@/components/archive/DictionaryModal";
import { DictionaryCard } from "@/components/archive/ui";
import { HeaderBar } from "@/components/archive/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import {
  getCachedDictionaryIndex,
  getLastDictionaryFetchAt,
  prefetchArchiveIndex,
  prefetchDictionaryEntryData,
  prefetchDictionaryIndex,
  setCachedDictionaryIndex,
} from "@/lib/archive";
import { DICTIONARY_CACHE_TTL_MS } from "@/lib/cacheConstants";
import { buildDictionarySlug, findDictionaryEntryBySlug } from "@/lib/dictionary";
import { filterDictionaryEntries } from "@/lib/filtering";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { type IndexedDictionaryEntry, type SortKey } from "@/lib/types";
import { siteConfig } from "@/lib/siteConfig";
import { setInternalNavigationFlag } from "@/hooks/useBackNavigation";

type Props = {
  entries: IndexedDictionaryEntry[];
};

const getEntriesUpdatedAt = (list: IndexedDictionaryEntry[]) =>
  list.reduce((max, entry) => Math.max(max, entry.index.updatedAt ?? 0), 0);

export function DictionaryPageClient({ entries }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "updated">("az");
  const [active, setActive] = useState<IndexedDictionaryEntry | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const entriesUpdatedAt = getEntriesUpdatedAt(entries);
  const cached = getCachedDictionaryIndex();
  const cachedEntries = cached?.index.entries ?? null;
  const cachedUpdatedAt = cached?.updatedAt ?? 0;
  const preferCached = !!cachedEntries && cachedUpdatedAt >= entriesUpdatedAt;
  const bootstrapEntries = preferCached && cachedEntries ? cachedEntries : entries;
  const [liveEntriesOverride, setLiveEntriesOverride] = useState<IndexedDictionaryEntry[] | null>(null);
  const liveEntries = liveEntriesOverride ?? bootstrapEntries;
  const pathSlug = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/dictionary\/(.+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1].replace(/\/+$/, ""));
  }, [pathname]);
  const slugEntryIndex = useMemo(() => {
    if (!pathSlug) return null;
    return findDictionaryEntryBySlug(liveEntries.map((e) => e.index), pathSlug);
  }, [pathSlug, liveEntries]);
  const activeMatchesSlug = !!active && !!slugEntryIndex && active.index.id === slugEntryIndex.id;
  const slugEntry = useMemo(() => {
    if (!slugEntryIndex) return null;
    return liveEntries.find((entry) => entry.index.id === slugEntryIndex.id) || { index: slugEntryIndex };
  }, [slugEntryIndex, liveEntries]);
  const modalEntry = activeMatchesSlug && active ? active : slugEntry;

  useEffect(() => {
    setInternalNavigationFlag();
  }, []);

  useEffect(() => {
    if (disableLiveFetch) return;
    prefetchArchiveIndex();
  }, []);

  const urlQuery = searchParams?.get("q") ?? "";
  const urlSortParam = searchParams?.get("sort");
  const urlSort = urlSortParam === "updated" ? "updated" : "az";

  useEffect(() => {
    startTransition(() => {
      setQuery(urlQuery);
    });
  }, [urlQuery]);

  useEffect(() => {
    startTransition(() => {
      setSort(urlSort);
    });
  }, [urlSort]);

  useEffect(() => {
    if (disableLiveFetch) return;
    let cancelled = false;
    const now = Date.now();
    const cachedNow = getCachedDictionaryIndex();
    const cachedFresh = cachedNow ? now - cachedNow.fetchedAt < DICTIONARY_CACHE_TTL_MS : false;
    const run = () => {
      prefetchDictionaryIndex()
        .then((fresh) => {
          if (cancelled || !fresh) return;
          const fetchedAt = getLastDictionaryFetchAt() || Date.now();
          setCachedDictionaryIndex(fresh, fetchedAt);
          const currentUpdatedAt = getEntriesUpdatedAt(liveEntries);
          const nextUpdatedAt = getEntriesUpdatedAt(fresh.entries);
          const isSame = currentUpdatedAt === nextUpdatedAt && liveEntries.length === fresh.entries.length;
          if (!isSame) setLiveEntriesOverride(fresh.entries);
        })
        .catch(() => { });
    };
    if (cachedFresh) {
      const delay = Math.max(0, DICTIONARY_CACHE_TTL_MS - (now - (cachedNow?.fetchedAt ?? now)));
      if (delay > 0) {
        const id = setTimeout(run, delay);
        return () => {
          cancelled = true;
          clearTimeout(id);
        };
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [liveEntries]);

  const filtered = useMemo(() => filterDictionaryEntries(liveEntries, query, sort), [liveEntries, query, sort]);

  const dictionaryTooltips = useMemo(() => {
    const map: Record<string, string> = {};
    liveEntries.forEach((entry) => {
      const summary = entry.index.summary?.trim();
      if (summary) map[entry.index.id] = summary;
    });
    return map;
  }, [liveEntries]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const baseTitle = `Dictionary · ${siteConfig.siteName}`;
    if (activeMatchesSlug && active) {
      const term = active.index.terms?.[0] || active.index.id;
      document.title = `${term} | ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [active, activeMatchesSlug]);

  useEffect(() => {
    activeIdRef.current = active?.index.id ?? null;
  }, [active]);

  useEffect(() => {
    if (!slugEntryIndex) return;
    if (activeIdRef.current === slugEntryIndex.id) return;
    const full = liveEntries.find((e) => e.index.id === slugEntryIndex.id) || { index: slugEntryIndex };
    if (full.data || disableLiveFetch) {
      startTransition(() => {
        setActive(full as IndexedDictionaryEntry);
      });
      return;
    }
    prefetchDictionaryEntryData(slugEntryIndex.id)
      .then((data) => {
        if (data) {
          setActive({ ...full, data });
        } else {
          setActive(full as IndexedDictionaryEntry);
        }
      });
  }, [slugEntryIndex, liveEntries]);

  const buildDictionaryUrl = (next?: { slug?: string | null; q?: string; sort?: "az" | "updated" }) => {
    const slug = next && "slug" in next ? next.slug : pathSlug;
    const q = (next && (next.q !== undefined) ? next.q : urlQuery).trim();
    const nextSort = next && next.sort ? next.sort : urlSort;
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (nextSort !== "az") sp.set("sort", nextSort);
    const base = slug ? `/dictionary/${encodeURIComponent(slug)}` : "/dictionary";
    const queryString = sp.toString();
    return queryString ? `${base}?${queryString}` : base;
  };

  const openEntry = (ent: IndexedDictionaryEntry) => {
    const slug = buildDictionarySlug(ent.index);
    router.push(buildDictionaryUrl({ slug }), { scroll: false });
  };

  const handleInternalLink = (url: URL) => {
    if (typeof window === "undefined") return false;
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.startsWith("/dictionary")) return false;
    let slug = url.pathname.replace(/^\/dictionary\/?/, "").replace(/\/+$/, "");
    if (slug) {
      try {
        slug = decodeURIComponent(slug);
      } catch {
        // ignore malformed slugs
      }
    }
    router.push(buildDictionaryUrl({ slug: slug || null }), { scroll: false });
    return true;
  };

  const commitSearch = () => {
    const nextQuery = query.trim();
    router.replace(buildDictionaryUrl({ q: nextQuery }));
  };

  const updateSort = (nextSort: "az" | "updated") => {
    setSort(nextSort);
    router.replace(buildDictionaryUrl({ sort: nextSort }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <HeaderBar
        siteName={siteConfig.siteName}
        view="dictionary"
        logoSrc={siteConfig.logoSrc}
        discordInviteUrl={siteConfig.discordInviteUrl}
        q={query}
        onSearchChange={setQuery}
        onSearchCommit={() => { }}
        sortKey={"newest" as SortKey}
        onSortChange={() => { }}
        dictionaryQuery={query}
        onDictionarySearchChange={setQuery}
        onDictionarySearchCommit={commitSearch}
        dictionarySort={sort}
        onDictionarySortChange={updateSort}
        onArchiveClick={() => router.push("/archives")}
        onDictionaryClick={() => { }}
      />

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6">
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">Showing {filtered.length} of {liveEntries.length} terms • Sorted {sort === "az" ? "A to Z" : "by updated time"}</div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <DictionaryCard
              key={entry.index.id}
              entry={entry}
              onOpen={openEntry}
            />
          ))}
        </div>
      </main>

      {modalEntry ? (
        <DictionaryModal
          entry={modalEntry}
          onClose={() => {
            //setActive(null);
            router.replace(buildDictionaryUrl({ slug: null }), { scroll: false });
          }}
          dictionaryTooltips={dictionaryTooltips}
          onInternalLink={handleInternalLink}
        />
      ) : null}
      <Footer />
    </div>
  );
}
