'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DictionaryModal } from "@/components/archive/DictionaryModal";
import { DictionaryCard } from "@/components/archive/ui";
import { HeaderBar } from "@/components/archive/HeaderBar";
import { fetchDictionaryEntry, fetchDictionaryIndex } from "@/lib/archive";
import { filterDictionaryEntries } from "@/lib/filtering";
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"az" | "updated">("az");
  const [active, setActive] = useState<IndexedDictionaryEntry | null>(null);
  const [loadingEntryId, setLoadingEntryId] = useState<string | null>(null);
  const [liveEntries, setLiveEntries] = useState(entries);

  useEffect(() => {
    setLiveEntries(entries);
  }, [entries]);

  useEffect(() => {
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
              onOpen={(ent) => {
                if (ent.data) {
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
              }}
            />
          ))}
        </div>
      </div>
    </main>

      {active ? (
        <DictionaryModal entry={active} onClose={() => setActive(null)} dictionaryTooltips={dictionaryTooltips} />
      ) : loadingEntryId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 text-sm text-white">Loading term…</div>
      ) : null}
    </div>
  );
}
