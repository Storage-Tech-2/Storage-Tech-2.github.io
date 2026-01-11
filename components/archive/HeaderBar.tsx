'use client';

import Image from "next/image";
import { clsx } from "@/lib/utils/classNames";
import { type SortKey } from "@/lib/types";
import Link from "next/link";

type Props = {
  owner: string;
  repo: string;
  branch: string;
  siteName: string;
  view: "archive" | "dictionary";
  logoSrc: string;
  discordInviteUrl?: string;
  q: string;
  onSearchChange: (val: string) => void;
  onSearchCommit: () => void;
  sortKey: SortKey;
  onSortChange: (val: SortKey) => void;
  dictionaryQuery: string;
  onDictionarySearchChange: (val: string) => void;
  onDictionarySearchCommit?: () => void;
  dictionarySort: "az" | "updated";
  onDictionarySortChange: (val: "az" | "updated") => void;
  onArchiveClick?: () => void;
  onDictionaryClick?: () => void;
};

export function HeaderBar({
  owner,
  repo,
  branch,
  siteName,
  view,
  logoSrc,
  discordInviteUrl,
  q,
  onSearchChange,
  onSearchCommit,
  sortKey,
  onSortChange,
  dictionaryQuery,
  onDictionarySearchChange,
  onDictionarySearchCommit,
  dictionarySort,
  onDictionarySortChange,
  onArchiveClick,
  onDictionaryClick,
}: Props) {
  const archiveRepoUrl = `https://github.com/${owner}/${repo}`;
  return (
    <header className="top-0 z-20 bg-white/80 backdrop-blur border-b dark:bg-gray-900/80 sm:sticky">
      <div className="mx-auto w-full px-2 py-3 sm:px-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-2 pb-1 sm:gap-3">
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/" className="h-10 w-10">
              <Image src={logoSrc} alt="Logo" width={40} height={40} className="h-10 w-10" />
            </Link>
            <div>
              <div className="text-xl font-bold">
                <Link href="/">{siteName}</Link>
              </div>
              <div className="text-xs text-gray-500">
               
                  {owner}/{repo}@{branch}
                
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm",
                view === "archive" ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-white dark:bg-gray-900",
              )}
              onClick={onArchiveClick}
            >
              Archive
            </Link>
            <Link
              href="/dictionary"
              className={clsx(
                "rounded-xl border px-3 py-2 text-sm",
                view === "dictionary" ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-white dark:bg-gray-900",
              )}
              onClick={onDictionaryClick}
            >
              Dictionary
            </Link>
          </div>

          {view === "archive" ? (
            <>
              <div className="relative min-w-50 w-full flex-1 sm:w-auto">
                <input
                  value={q}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onBlur={onSearchCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearchCommit();
                  }}
                  placeholder="Search posts, codes, tags, authors"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
              </div>
              <select
                value={sortKey}
                onChange={(e) => onSortChange(e.target.value as SortKey)}
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
          ) : (
            <>
              <div className="relative min-w-50 w-full flex-1 sm:w-auto">
                <input
                  value={dictionaryQuery}
                  onChange={(e) => onDictionarySearchChange(e.target.value)}
                  onBlur={onDictionarySearchCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onDictionarySearchCommit?.();
                  }}
                  placeholder="Search dictionary terms"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
              </div>
              <select
                value={dictionarySort}
                onChange={(e) => onDictionarySortChange(e.target.value as "az" | "updated")}
                className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
                aria-label="Sort dictionary terms"
              >
                <option value="az">A to Z</option>
                <option value="updated">Updated (newest)</option>
              </select>
            </>
          )}

          {discordInviteUrl ? (
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-xl border border-blue-600 bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Join Discord
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
