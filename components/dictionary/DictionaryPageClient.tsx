'use client';

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DictionaryModal } from "@/components/archive/DictionaryModal";
import { DictionaryCard } from "@/components/archive/ui";
import { HeaderBar } from "@/components/archive/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { fetchDictionaryEntry, fetchDictionaryIndex } from "@/lib/archive";
import { buildDictionarySlug, findDictionaryEntryBySlug } from "@/lib/dictionary";
import { filterDictionaryEntries } from "@/lib/filtering";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { type IndexedDictionaryEntry, type SortKey } from "@/lib/types";
import { siteConfig } from "@/lib/siteConfig";

type Props = {
  entries: IndexedDictionaryEntry[];
  owner: string;
  repo: string;
  branch: string;
};

export function DictionaryPageClient({ entries, owner, repo, branch }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const initialFilters = useMemo(() => {
    if (typeof window === "undefined") {
      return { query: "", sort: "az" as const };
    }
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q") || "";
    const sortParam = sp.get("sort");
    const sortValue = sortParam === "updated" ? "updated" : "az";
    return { query: q, sort: sortValue };
  }, []);

  const [query, setQuery] = useState(initialFilters.query);
  const [sort, setSort] = useState<"az" | "updated">(initialFilters.sort);
  const [active, setActive] = useState<IndexedDictionaryEntry | null>(null);
  const [loadingEntryId, setLoadingEntryId] = useState<string | null>(null);
  const [liveEntries, setLiveEntries] = useState(entries);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const pathSlug = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/dictionary\/(.+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1].replace(/\/+$/, ""));
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get("q") || "";
      const sortParam = sp.get("sort");
      const sortValue = sortParam === "updated" ? "updated" : "az";
      setQuery(q);
      setSort(sortValue);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    setLiveEntries(entries);
  }, [entries]);

  useEffect(() => {
    if (pathSlug) setCurrentSlug(pathSlug);
  }, [pathSlug]);

  useEffect(() => {
    if (disableLiveFetch) return;
    let cancelled = false;
    fetchDictionaryIndex(owner, repo, branch, "no-store")
      .then((fresh) => {
        if (!cancelled) setLiveEntries(fresh.entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner, repo, branch]);

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
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("q", query.trim());
    if (sort !== "az") sp.set("sort", sort);
    const queryString = sp.toString();
    const path = currentSlug ? `/dictionary/${encodeURIComponent(currentSlug)}` : "/dictionary";
    const next = queryString ? `${path}?${queryString}` : path;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [query, sort, currentSlug]);

  useEffect(() => {
    if (!pathSlug) {
      return;
    }
    const entryIndex = findDictionaryEntryBySlug(liveEntries.map((e) => e.index), pathSlug);
    if (!entryIndex) return;
    if (active?.index.id === entryIndex.id) return;
    const full = liveEntries.find((e) => e.index.id === entryIndex.id) || { index: entryIndex };
    if (full.data || disableLiveFetch) {
      setActive(full as IndexedDictionaryEntry);
      return;
    }
    setLoadingEntryId(entryIndex.id);
    fetchDictionaryEntry(entryIndex.id, owner, repo, branch, "no-store")
      .then((data) => {
        setActive({ ...full, data });
      })
      .catch(() => {
        setActive(full as IndexedDictionaryEntry);
      })
      .finally(() => {
        setLoadingEntryId(null);
      });
  }, [pathSlug, liveEntries, owner, repo, branch, active]);

  const openEntry = (ent: IndexedDictionaryEntry) => {
    const slug = buildDictionarySlug(ent.index);
    setCurrentSlug(slug);
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const queryString = sp.toString();
      const next = queryString ? `/dictionary/${encodeURIComponent(slug)}?${queryString}` : `/dictionary/${encodeURIComponent(slug)}`;
      window.history.replaceState(null, "", next);
    }
    if (ent.data || disableLiveFetch) {
      setActive(ent);
      return;
    }
    setLoadingEntryId(ent.index.id);
    fetchDictionaryEntry(ent.index.id, owner, repo, branch, "no-store")
      .then((data) => {
        setActive({ ...ent, data });
      })
      .catch(() => {
        setActive(ent);
      })
      .finally(() => {
        setLoadingEntryId(null);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <HeaderBar
        owner={owner}
        repo={repo}
        branch={branch}
        siteName={siteConfig.siteName}
        view="dictionary"
        logoSrc={siteConfig.logoSrc}
        discordInviteUrl={siteConfig.discordInviteUrl}
        q={query}
        onSearchChange={setQuery}
        onSearchCommit={() => {}}
        sortKey={"newest" as SortKey}
        onSortChange={() => {}}
        dictionaryQuery={query}
        onDictionarySearchChange={setQuery}
        dictionarySort={sort}
        onDictionarySortChange={setSort}
        onArchiveClick={() => router.push("/")}
        onDictionaryClick={() => {}}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 pb-12 pt-4 lg:px-4">
        <div className="rounded-xl border bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dictionary</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">Browse all terms without leaving the page.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((entry) => (
            <DictionaryCard
              key={entry.index.id}
              entry={entry}
              onOpen={openEntry}
            />
          ))}
        </div>
      </div>
    </main>

      {active ? (
        <DictionaryModal
          entry={active}
          onClose={() => {
            setActive(null);
            setCurrentSlug(null);
            if (typeof window !== "undefined") {
              const sp = new URLSearchParams(window.location.search);
              const queryString = sp.toString();
              const next = queryString ? `/dictionary?${queryString}` : "/dictionary";
              if (pathSlug) {
                router.replace(next);
              } else {
                window.history.replaceState(null, "", next);
              }
            }
          }}
          dictionaryTooltips={dictionaryTooltips}
        />
      ) : loadingEntryId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 text-sm text-white">Loading term…</div>
      ) : null}
      <Footer />
    </div>
  );
}
