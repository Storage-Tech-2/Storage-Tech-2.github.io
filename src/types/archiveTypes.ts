import { type ArchiveEntryData, type ChannelRef, type DictionaryEntry, type DictionaryIndexEntry, type EntryRef } from "./schema"

export type IndexedPost = {
  channel: ChannelRef
  entry: EntryRef
  data?: ArchiveEntryData
}

export type IndexedDictionaryEntry = {
  index: DictionaryIndexEntry
  data?: DictionaryEntry
}

export type SortKey = "newest" | "oldest" | "archived" | "archivedOldest" | "az"

export const getEntryUpdatedAt = (entry: Pick<EntryRef, "updatedAt" | "archivedAt" | "timestamp">) => entry.updatedAt ?? entry.archivedAt ?? entry.timestamp
export const getEntryArchivedAt = (entry: Pick<EntryRef, "updatedAt" | "archivedAt" | "timestamp">) => entry.archivedAt ?? entry.timestamp ?? entry.updatedAt
