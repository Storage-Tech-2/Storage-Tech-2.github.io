import React, { useCallback, useMemo } from "react"
import { AutoSizer, List, WindowScroller } from "react-virtualized"
import { type ChannelRef, type Tag, type IndexedPost, type SortKey } from "../types"
import { normalize } from "../utils"
import { ArchiveFilters } from "./ArchiveFilters"
import { PostCard, TagChip } from "./ArchiveUI"

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
  openCard: (p: IndexedPost, replace?: boolean, keepView?: boolean) => void
  ensurePostLoaded: (p: IndexedPost) => Promise<IndexedPost>
  sortKey: SortKey
  resetFilters: () => void
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
  resetFilters,
}: Props) {
  return (
    <div className="mx-auto w-full px-2 sm:px-4 lg:px-6">
      <div className="flex flex-col gap-6 pb-12 pt-4 lg:flex-row lg:items-start lg:gap-8">
        <aside className="lg:w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-2 lg:max-h-[calc(100vh-120px)] lg:overflow-auto pr-1">
          <ArchiveFilters
            channels={channels}
            selectedChannels={selectedChannels}
            channelCounts={channelCounts}
            onToggleChannel={toggleChannel}
            onResetFilters={resetFilters}
          />
        </aside>

        <div className="flex-1">
          {error && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {loading && <div className="mb-3 rounded-lg border bg-white p-3 text-sm dark:bg-gray-900">Loading repository metadata...</div>}

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Tags</span>
            <div className="inline-flex items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1">
                <input type="radio" name="tagMode" value="AND" checked={tagMode === "AND"} onChange={() => setTagMode("AND")} />
                <span>Match all</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" name="tagMode" value="OR" checked={tagMode === "OR"} onChange={() => setTagMode("OR")} />
                <span>Match any</span>
              </label>
              <span className="text-gray-500">Tip: click tag twice to exclude</span>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {allTags.map(tag => (
              <TagChip key={tag.id} tag={tag} state={tagState[tag.name] || 0} count={tagCounts[normalize(tag.name)] || 0} onToggle={() => toggleTag(tag.name)} />
            ))}
          </div>

          <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">Showing {filtered.length} of {posts.length} posts</div>
          <VirtualizedPostGrid filtered={filtered} openCard={openCard} ensurePostLoaded={ensurePostLoaded} sortKey={sortKey} />
        </div>
      </div>
    </div>
  )
}

const GRID_GAP = 16
const CARD_HEIGHT = 350
const SCROLLBAR_FUDGE = 20
const ROW_HEIGHT = CARD_HEIGHT + GRID_GAP

function getColumnCount(width: number) {
  const effectiveWidth = width + SCROLLBAR_FUDGE
  // Adjusted breakpoints to account for container padding vs viewport width
  if (effectiveWidth >= 1240) return 4
  if (effectiveWidth >= 980) return 3
  if (effectiveWidth >= 640) return 2
  return 1
}

function VirtualizedPostGrid({
  filtered,
  openCard,
  ensurePostLoaded,
  sortKey,
}: Pick<Props, "filtered" | "openCard" | "ensurePostLoaded" | "sortKey">) {
  if (!filtered.length) return null

  return (
    <WindowScroller>
      {({ height, isScrolling, onChildScroll, registerChild, scrollTop }) => (
        <AutoSizer disableHeight>
          {({ width }) => (
            <VirtualizedGridContent
              filtered={filtered}
              openCard={openCard}
              ensurePostLoaded={ensurePostLoaded}
              sortKey={sortKey}
              width={width}
              height={height}
              isScrolling={isScrolling}
              onChildScroll={onChildScroll}
              registerChild={registerChild}
              scrollTop={scrollTop}
            />
          )}
        </AutoSizer>
      )}
    </WindowScroller>
  )
}

type GridContentProps = Pick<Props, "filtered" | "openCard" | "ensurePostLoaded" | "sortKey"> & {
  width: number
  height: number
  isScrolling: boolean
  onChildScroll: (params: { clientHeight: number; scrollHeight: number; scrollTop: number }) => void
  registerChild: (el: Element | null) => void
  scrollTop: number
}

function VirtualizedGridContent({
  filtered,
  openCard,
  ensurePostLoaded,
  sortKey,
  width,
  height,
  isScrolling,
  onChildScroll,
  registerChild,
  scrollTop,
}: GridContentProps) {
  const columnCount = useMemo(() => getColumnCount(width), [width])
  const rowCount = useMemo(() => Math.ceil(filtered.length / columnCount), [filtered.length, columnCount])

  const rowRenderer = useCallback(
    ({ index, key, style }: { index: number; key: string; style: React.CSSProperties }) => {
      const start = index * columnCount
      const rowItems = filtered.slice(start, start + columnCount)
      return (
        <div key={key} style={{ ...style, paddingBottom: GRID_GAP }}>
          <div
            style={{
              display: "grid",
              gap: GRID_GAP,
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              alignItems: "stretch",
            }}
          >
            {rowItems.map((p) => (
              <div key={`${p.channel.path}/${p.entry.path}`} style={{ height: CARD_HEIGHT }}>
                <PostCard
                  p={p}
                  onOpen={openCard}
                  ensurePostLoaded={ensurePostLoaded}
                  sortKey={sortKey}
                />
              </div>
            ))}
          </div>
        </div>
      )
    },
    [columnCount, ensurePostLoaded, filtered, openCard, sortKey],
  )

  return (
    <div ref={registerChild}>
      <List
        autoHeight
        height={height}
        width={width}
        rowCount={rowCount}
        rowHeight={ROW_HEIGHT}
        rowRenderer={rowRenderer}
        overscanRowCount={4}
        isScrolling={isScrolling}
        onScroll={onChildScroll}
        scrollTop={scrollTop}
        style={{ outline: "none" }}
      />
    </div>
  )
}
