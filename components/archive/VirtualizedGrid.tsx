'use client';

import { useCallback, useMemo } from "react";
import { AutoSizer, List, WindowScroller } from "react-virtualized";
import { PostCard } from "./PostCard";
import { type ArchiveListItem } from "@/lib/archive";
import { type SortKey } from "@/lib/types";

const GRID_GAP = 16;
const CARD_HEIGHT = 380;
const SCROLLBAR_FUDGE = 20;
const ROW_HEIGHT = CARD_HEIGHT + GRID_GAP;

type Props = {
  posts: ArchiveListItem[];
  sortKey: SortKey;
  onNavigate: (post: ArchiveListItem) => void;
  ensurePostLoaded: (p: ArchiveListItem) => Promise<ArchiveListItem>;
};

function getColumnCount(width: number) {
  const effectiveWidth = width + SCROLLBAR_FUDGE;
  if (effectiveWidth >= 1280) return 4;
  if (effectiveWidth >= 1024) return 3;
  if (effectiveWidth >= 640) return 2;
  return 1;
}

export function VirtualizedGrid({ posts, sortKey, onNavigate, ensurePostLoaded }: Props) {
  if (typeof window === "undefined") {
    const fallback = posts.slice(0, 24);
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fallback.map((post) => (
          <PostCard key={`${post.channel.path}/${post.entry.path}`} post={post} sortKey={sortKey} ensurePostLoaded={ensurePostLoaded} onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  if (!posts.length) return null;

  return (
    <WindowScroller>
      {({ height, isScrolling, onChildScroll, registerChild, scrollTop }) => (
        <AutoSizer disableHeight>
          {({ width }) => (
            <VirtualizedGridContent
              posts={posts}
              onNavigate={onNavigate}
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
  );
}

type GridContentProps = Props & {
  width: number;
  height: number;
  isScrolling: boolean;
  onChildScroll: (params: { clientHeight: number; scrollHeight: number; scrollTop: number }) => void;
  registerChild: (el: Element | null) => void;
  scrollTop: number;
};

function VirtualizedGridContent({
  posts,
  onNavigate,
  ensurePostLoaded,
  sortKey,
  width,
  height,
  isScrolling,
  onChildScroll,
  registerChild,
  scrollTop,
}: GridContentProps) {
  const columnCount = useMemo(() => {
    const viewport = typeof window !== "undefined" ? window.innerWidth : width;
    return getColumnCount(Math.max(width, viewport));
  }, [width]);
  const rowCount = useMemo(() => Math.ceil(posts.length / columnCount), [posts.length, columnCount]);

  const rowRenderer = useCallback(
    ({ index, key, style }: { index: number; key: string; style: React.CSSProperties }) => {
      const start = index * columnCount;
      const rowItems = posts.slice(start, start + columnCount);
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
                <PostCard post={p} onNavigate={onNavigate} ensurePostLoaded={ensurePostLoaded} sortKey={sortKey} />
              </div>
            ))}
          </div>
        </div>
      );
    },
    [posts, columnCount, onNavigate, ensurePostLoaded, sortKey],
  );

  return (
    <div ref={registerChild}>
      <List
        autoHeight
        height={height}
        width={width}
        rowCount={rowCount}
        rowHeight={ROW_HEIGHT}
        rowRenderer={rowRenderer}
        isScrolling={isScrolling}
        onScroll={onChildScroll}
        scrollTop={scrollTop}
      />
    </div>
  );
}
