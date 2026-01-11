'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DictionaryModal } from "@/components/archive/DictionaryModal";
import { DictionaryCard } from "@/components/archive/ui";
import { HeaderBar } from "@/components/archive/HeaderBar";
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

  const filtered = useMemo(() => filterDictionaryEntries(entries, query, sort), [entries, query, sort]);

  const dictionaryTooltips = useMemo(() => {
    const map: Record<string, string> = {};
    entries.forEach((entry) => {
      const summary = entry.index.summary?.trim();
      if (summary) map[entry.index.id] = summary;
    });
    return map;
  }, [entries]);

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
            <div className="flex flex-wrap gap-2 md:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dictionary"
                className="rounded-xl border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-800"
              />
              <select
                className="rounded-xl border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                value={sort}
                onChange={(e) => setSort(e.target.value as "az" | "updated")}
              >
                <option value="az">A–Z</option>
                <option value="updated">Recently updated</option>
              </select>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {filtered.map((entry) => (
              <DictionaryCard key={entry.index.id} entry={entry} onOpen={(ent) => setActive(ent)} />
            ))}
          </div>
        </div>
      </main>

      {active ? (
        <DictionaryModal entry={active} onClose={() => setActive(null)} dictionaryTooltips={dictionaryTooltips} />
      ) : null}
    </div>
  );
}
