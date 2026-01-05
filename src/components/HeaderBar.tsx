import React from "react"
import { clsx } from "../utils"
import { type SortKey } from "../types"

type Props = {
  owner: string
  repo: string
  branch: string
  view: "archive" | "dictionary"
  logoSrc: string
  q: string
  onSearchChange: (val: string) => void
  onSearchCommit: () => void
  sortKey: SortKey
  onSortChange: (val: SortKey) => void
  dictionaryQuery: string
  onDictionarySearchChange: (val: string) => void
  dictionarySort: "az" | "updated"
  onDictionarySortChange: (val: "az" | "updated") => void
  onArchiveClick: () => void
  onDictionaryClick: () => void
}

export function HeaderBar({
  owner,
  repo,
  branch,
  view,
  logoSrc,
  q,
  onSearchChange,
  onSearchCommit,
  sortKey,
  onSortChange,
  dictionaryQuery,
  onDictionarySearchChange,
  dictionarySort,
  onDictionarySortChange,
  onArchiveClick,
  onDictionaryClick,
}: Props) {
  return (
    <header className="sm:sticky top-0 z-20 border-b bg-white/80 backdrop-blur dark:bg-gray-900/80">
      <div className="mx-auto w-full px-2 sm:px-4 lg:px-6 py-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pb-1">
          <div className="flex items-center gap-3 flex-shrink-0">
            <img src={logoSrc} alt="Logo" className="h-10 w-10" />
            <div>
              <div className="text-xl font-bold"><a href="/">Storage Tech 2</a></div>
              <div className="text-xs text-gray-500"><a href="https://github.com/Storage-Tech-2/Archive">{owner}/{repo}@{branch}</a></div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onArchiveClick} className={clsx("rounded-xl border px-3 py-2 text-sm", view === "archive" ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-white dark:bg-gray-900")}>Archive</button>
            <button onClick={onDictionaryClick} className={clsx("rounded-xl border px-3 py-2 text-sm", view === "dictionary" ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-white dark:bg-gray-900")}>Dictionary</button>
          </div>

          {view === "archive" ? (
            <>
              <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                <input
                  value={q}
                  onChange={e => onSearchChange(e.target.value)}
                  onBlur={onSearchCommit}
                  onKeyDown={(e) => { if (e.key === "Enter") onSearchCommit() }}
                  placeholder="Search posts, codes, tags"
                  className="w-full rounded-xl border px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
                />
                <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
              </div>
              <select value={sortKey} onChange={e => onSortChange(e.target.value as SortKey)} className="rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 flex-shrink-0">
                <option value="newest">Updated (newest)</option>
                <option value="oldest">Updated (oldest)</option>
                <option value="archived">Archived (newest)</option>
                <option value="archivedOldest">Archived (oldest)</option>
                <option value="az">A to Z</option>
              </select>
            </>
          ) : (
            <>
              <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                <input value={dictionaryQuery} onChange={e => onDictionarySearchChange(e.target.value)} placeholder="Search dictionary terms" className="w-full rounded-xl border px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900" />
                <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
              </div>
              <select value={dictionarySort} onChange={e => onDictionarySortChange(e.target.value as "az" | "updated")} className="rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 flex-shrink-0">
                <option value="az">A to Z</option>
                <option value="updated">Updated (newest)</option>
              </select>
            </>
          )}

          <a href="https://discord.gg/hztJMTsx2m" target="_blank" rel="noreferrer" className="flex-shrink-0 rounded-xl border px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
            Join Discord
          </a>
        </div>
      </div>
    </header>
  )
}
