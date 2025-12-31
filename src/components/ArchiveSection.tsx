import React from "react"
import { type ChannelRef, type Tag, type IndexedPost, type SortKey } from "../types"
import { ArchiveFilters } from "./ArchiveFilters"
import { PostCard } from "./ArchiveUI"

type Props = {
  channels: ChannelRef[]
  selectedChannels: string[]
  channelCounts: Record<string, number>
  toggleChannel: (code: string) => void
  tagMode: "OR" | "AND"
  setTagMode: (mode: "OR" | "AND") => void
  allTags: Tag[]
  tagState: Record<string, -1 | 0 | 1>
  toggleTag: (name: string) => void
  tagCounts: Record<string, number>
  error: string | null
  loading: boolean
  filtered: IndexedPost[]
  posts: IndexedPost[]
  openCard: (p: IndexedPost) => void
  ensurePostLoaded: (p: IndexedPost) => Promise<IndexedPost>
  sortKey: SortKey
}

export function ArchiveSection({
  channels,
  selectedChannels,
  channelCounts,
  toggleChannel,
  tagMode,
  setTagMode,
  allTags,
  tagState,
  toggleTag,
  tagCounts,
  error,
  loading,
  filtered,
  posts,
  openCard,
  ensurePostLoaded,
  sortKey,
}: Props) {
  return (
    <>
      <ArchiveFilters
        channels={channels}
        selectedChannels={selectedChannels}
        channelCounts={channelCounts}
        onToggleChannel={toggleChannel}
        tagMode={tagMode}
        onTagModeChange={setTagMode}
        allTags={allTags}
        tagState={tagState}
        onToggleTag={toggleTag}
        tagCounts={tagCounts}
      />

      <div className="mx-auto max-w-7xl px-4">
        {error && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {loading && <div className="mb-3 rounded-lg border bg-white p-3 text-sm dark:bg-gray-900">Loading repository metadata...</div>}
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">Showing {filtered.length} of {posts.length} posts</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <PostCard key={`${p.channel.path}/${p.entry.path}`} p={p} onOpen={openCard} ensurePostLoaded={ensurePostLoaded} sortKey={sortKey} />
          ))}
        </div>
      </main>
    </>
  )
}
