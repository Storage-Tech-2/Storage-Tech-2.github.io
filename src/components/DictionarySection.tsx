import React from "react"
import { type IndexedDictionaryEntry } from "../types"
import { DictionaryCard } from "./ArchiveUI"

type Props = {
  dictionaryError: string | null
  dictionaryLoading: boolean
  filteredDictionary: IndexedDictionaryEntry[]
  dictionaryEntries: IndexedDictionaryEntry[]
  dictionarySort: "az" | "updated"
  openDictionaryEntry: (entry: IndexedDictionaryEntry) => void
}

export function DictionarySection({
  dictionaryError,
  dictionaryLoading,
  filteredDictionary,
  dictionaryEntries,
  dictionarySort,
  openDictionaryEntry,
}: Props) {
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-3">
        {dictionaryError && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{dictionaryError}</div>}
        {dictionaryLoading && <div className="mb-3 rounded-lg border bg-white p-3 text-sm dark:bg-gray-900">Loading dictionary...</div>}
      </div>
      <main className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">Showing {filteredDictionary.length} of {dictionaryEntries.length} terms • Sorted {dictionarySort === "az" ? "A to Z" : "by updated time"}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDictionary.map((entry) => (
            <DictionaryCard key={entry.index.id} entry={entry} onOpen={openDictionaryEntry} />
          ))}
        </div>
      </main>
    </>
  )
}
