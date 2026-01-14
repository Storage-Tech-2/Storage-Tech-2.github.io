'use client';

import { startTransition, useEffect, useMemo, useState } from "react";
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
import {
  getDictionaryStateFromUrl,
  readDictionarySession,
  setDictionaryStateToUrl,
  writeDictionarySession,
} from "@/lib/urlState";

type Props = {
  entries: IndexedDictionaryEntry[];
};

export function DictionaryPageClient({ entries }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<"az" | "updated">("az");
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
    const fromUrl = getDictionaryStateFromUrl(pathname);
    const hasUrlState = fromUrl.committedQuery || fromUrl.sort !== "az" || !!fromUrl.slug;
    const fromSession = hasUrlState ? null : readDictionarySession();
    const next = fromSession
      ? {
        query: fromSession.query || "",
        committedQuery: fromSession.committedQuery ?? fromSession.query ?? "",
        sort: (fromSession.sort === "updated" ? "updated" : "az") as "az" | "updated",
        slug: fromSession.slug ?? null,
      }
      : fromUrl;
    startTransition(() => {
      setQuery(next.query);
      setCommittedQuery(next.committedQuery);
      setSort(next.sort);
      setCurrentSlug(next.slug ?? null);
    });
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = getDictionaryStateFromUrl(pathname);
      startTransition(() => {
        setQuery(parsed.query);
        setCommittedQuery(parsed.committedQuery);
        setSort(parsed.sort);
        setCurrentSlug(parsed.slug ?? null);
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname]);

  useEffect(() => {
    setLiveEntries(entries);
  }, [entries]);

  useEffect(() => {
    if (pathSlug) setCurrentSlug(pathSlug);
  }, [pathSlug]);

  useEffect(() => {
    if (disableLiveFetch) return;
    let cancelled = false;
    fetchDictionaryIndex()
      .then((fresh) => {
        if (!cancelled) setLiveEntries(fresh.entries);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setDictionaryStateToUrl({
      query,
      committedQuery,
      sort,
      slug: currentSlug,
    });
  }, [committedQuery, sort, currentSlug, query]);

  useEffect(() => {
    writeDictionarySession({
      query,
      committedQuery,
      sort,
      slug: currentSlug,
    });
  }, [query, committedQuery, sort, currentSlug]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const baseTitle = `Dictionary · ${siteConfig.siteName}`;
    if (active) {
      const term = active.index.terms?.[0] || active.index.id;
      document.title = `${term} | ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [active]);

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
    fetchDictionaryEntry(entryIndex.id)
      .then((data) => {
        setActive({ ...full, data });
      })
      .catch(() => {
        setActive(full as IndexedDictionaryEntry);
      })
      .finally(() => {
        setLoadingEntryId(null);
      });
  }, [pathSlug, liveEntries, active]);

  const openEntry = (ent: IndexedDictionaryEntry) => {
    const slug = buildDictionarySlug(ent.index);
    setCurrentSlug(slug);
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const queryString = sp.toString();
      const next = queryString ? `/dictionary/${encodeURIComponent(slug)}?${queryString}` : `/dictionary/${encodeURIComponent(slug)}`;
      window.history.replaceState(window.history.state, "", next);
    }
    if (ent.data || disableLiveFetch) {
      setActive(ent);
      return;
    }
    setLoadingEntryId(ent.index.id);
    fetchDictionaryEntry(ent.index.id)
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
        onDictionarySearchCommit={() => setCommittedQuery(query)}
        dictionarySort={sort}
        onDictionarySortChange={setSort}
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
                window.history.replaceState(window.history.state, "", next);
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
