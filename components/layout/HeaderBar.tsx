'use client';

import Image from "next/image";
import { clsx } from "@/lib/utils/classNames";
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO, type SortKey } from "@/lib/types";
import { prefetchArchiveIndex, prefetchDictionaryIndex } from "@/lib/archive";
import { ForesightPrefetchLink } from "../ui/ForesightPrefetchLink";

type HeaderSearchFilters = {
  q: string;
  setQ(val: string): void;
  commitSearch(): void;
};

type HeaderSortFilters<TSort extends string> = {
  key: TSort;
  setKey(val: TSort): void;
};

type HeaderFilters<TSort extends string> = {
  search: HeaderSearchFilters;
  sort: HeaderSortFilters<TSort>;
};

type ArchiveHeaderFilters = HeaderFilters<SortKey>;
type DictionaryHeaderFilters = HeaderFilters<"az" | "updated">;

type BaseProps = {
  siteName: string;
  view: "home" | "archive" | "dictionary";
  logoSrc: string;
  discordInviteUrl?: string;
  onLogoClick?(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
  onArchiveClick?(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void;
};

type Props =
  | (BaseProps & { view: "home"; filters?: undefined })
  | (BaseProps & { view: "archive"; filters?: ArchiveHeaderFilters })
  | (BaseProps & { view: "dictionary"; filters?: DictionaryHeaderFilters });

export function HeaderBar(props: Props) {
  const { siteName, view, logoSrc, discordInviteUrl, onLogoClick, onArchiveClick } = props;
  const archiveFilters = view === "archive" ? props.filters : undefined;
  const dictionaryFilters = view === "dictionary" ? props.filters : undefined;
  const archiveSortKey = archiveFilters?.sort.key ?? "newest";
  const dictionarySortValue = dictionaryFilters?.sort.key ?? "az";
  const searchValue = archiveFilters?.search.q ?? "";
  const dictionarySearchValue = dictionaryFilters?.search.q ?? "";
  const handleSearchChange = archiveFilters?.search.setQ ?? (() => {});
  const handleSearchCommit = archiveFilters?.search.commitSearch ?? (() => {});
  const handleSortChange = archiveFilters?.sort.setKey ?? (() => {});
  const handleDictionarySearchChange = dictionaryFilters?.search.setQ ?? (() => {});
  const handleDictionarySearchCommit = dictionaryFilters?.search.commitSearch ?? (() => {});
  const handleDictionarySortChange = dictionaryFilters?.sort.setKey ?? (() => {});

  return (
    <header className="top-0 z-20 bg-white/80 backdrop-blur border-b dark:bg-gray-900/80 sm:sticky">
      <div className="mx-auto w-full px-2 py-3 sm:px-4 lg:px-6">
        <div className="flex w-full flex-wrap items-center gap-2 pb-1 sm:gap-3">
          <div className="flex shrink-0 items-center gap-3">
            <ForesightPrefetchLink href="/" className="h-10 w-10" onClick={onLogoClick}>
              <Image src={logoSrc} alt="Logo" width={40} height={40} className="h-10 w-10" />
            </ForesightPrefetchLink>
            <ForesightPrefetchLink href="/" onClick={onLogoClick}>
            <div>
              <div className="text-xl font-bold">
                {siteName}
              </div>
              <div className="text-xs text-gray-500">
               
                  {DEFAULT_OWNER}/{DEFAULT_REPO}@{DEFAULT_BRANCH}
                
              </div>
            </div>
            </ForesightPrefetchLink>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ForesightPrefetchLink
              href="/"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm transition",
                view === "home"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-white text-gray-800 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800",
              )}
            >
              Home
            </ForesightPrefetchLink>
            <ForesightPrefetchLink
              href="/archives"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm transition",
                view === "archive"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-white text-gray-800 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800",
              )}
              beforePrefetch={() => prefetchArchiveIndex()}
              onClick={onArchiveClick}
            >
              Archive
            </ForesightPrefetchLink>
            <ForesightPrefetchLink
              href="/dictionary"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm transition",
                view === "dictionary"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-white text-gray-800 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800",
              )}
              beforePrefetch={() => prefetchDictionaryIndex()}
            >
              Dictionary
            </ForesightPrefetchLink>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            {view === "archive" ? (
              <>
                <div className="relative min-w-55 flex-1 sm:w-auto">
                  <input
                    value={searchValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onBlur={handleSearchCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearchCommit();
                    }}
                    placeholder="Search posts, codes, tags, authors"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900"
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
                </div>
                <select
                  value={archiveSortKey}
                  onChange={(e) => handleSortChange(e.target.value as SortKey)}
                  className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
                  aria-label="Sort posts"
                >
                  <option value="newest">Updated (newest)</option>
                  <option value="oldest">Updated (oldest)</option>
                  <option value="archived">Archived (newest)</option>
                  <option value="archivedOldest">Archived (oldest)</option>
                  <option value="az">A to Z</option>
                </select>
              </>
            ) : view === "dictionary" ? (
              <>
                <div className="relative min-w-55 flex-1 sm:w-auto">
                  <input
                    value={dictionarySearchValue}
                    onChange={(e) => handleDictionarySearchChange(e.target.value)}
                    onBlur={handleDictionarySearchCommit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDictionarySearchCommit();
                    }}
                    placeholder="Search dictionary terms"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900"
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
                </div>
                <select
                  value={dictionarySortValue}
                  onChange={(e) => handleDictionarySortChange(e.target.value as "az" | "updated")}
                  className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
                  aria-label="Sort dictionary terms"
                >
                  <option value="az">A to Z</option>
                  <option value="updated">Updated (newest)</option>
                </select>
              </>
            ) : null}

            {discordInviteUrl ? (
              <div className="ml-auto flex items-center gap-2">
                <a
                  href={discordInviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Join Discord
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
