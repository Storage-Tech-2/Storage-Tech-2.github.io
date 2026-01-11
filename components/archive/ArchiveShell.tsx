'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveFilters } from "./ArchiveFilters";
import { TagChip } from "./ui";
import { HeaderBar } from "./HeaderBar";
import { PostCard } from "./PostCard";
import { VirtualizedGrid } from "./VirtualizedGrid";
import { useArchiveData } from "@/hooks/useArchiveData";
import { useDictionaryData } from "@/hooks/useDictionaryData";
import { type ArchiveIndex, type ArchiveListItem } from "@/lib/archive";
import { filterPosts, computeChannelCounts, computeTagCounts } from "@/lib/filtering";
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO, type IndexedDictionaryEntry, type SortKey } from "@/lib/types";
import { normalize } from "@/lib/utils/strings";
import { getSpecialTagMeta, sortTagObjectsForDisplay } from "@/lib/utils/tagDisplay";
import { siteConfig } from "@/lib/siteConfig";

type Props = {
  initialArchive: ArchiveIndex;
  initialDictionary: { entries: IndexedDictionaryEntry[] };
  owner?: string;
  repo?: string;
  branch?: string;
};

export function ArchiveShell({
  initialArchive,
  initialDictionary,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
}: Props) {
  const router = useRouter();
  const { posts, channels, loading, error, ensurePostLoaded } = useArchiveData({ initial: initialArchive, owner, repo, branch });
  useDictionaryData({
    initial: initialDictionary,
    owner,
    repo,
    branch,
  });

  const [q, setQ] = useState("");
  const [tagMode, setTagMode] = useState<"OR" | "AND">("AND");
  const [tagState, setTagState] = useState<Record<string, -1 | 0 | 1>>({});
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [dictionaryQuery, setDictionaryQuery] = useState("");
  const [dictionarySort, setDictionarySort] = useState<"az" | "updated">("az");

  // Restore state from session storage
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = typeof window !== "undefined" ? sessionStorage.getItem("archive-filters") : null;
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.q) setQ(parsed.q);
      if (parsed.tagMode) setTagMode(parsed.tagMode);
      if (parsed.tagState) setTagState(parsed.tagState);
      if (parsed.selectedChannels) setSelectedChannels(parsed.selectedChannels);
      if (parsed.sortKey) setSortKey(parsed.sortKey);
    } catch {
      // ignore malformed state
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem("archive-scroll");
    if (!savedScroll) return;
    const y = parseInt(savedScroll, 10);
    if (!Number.isNaN(y)) {
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
    sessionStorage.removeItem("archive-scroll");
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      "archive-filters",
      JSON.stringify({
        q,
        tagMode,
        tagState,
        selectedChannels,
        sortKey,
      }),
    );
  }, [q, tagMode, tagState, selectedChannels, sortKey]);

  const includeTags = useMemo(() => Object.keys(tagState).filter((k) => tagState[k] === 1).map(normalize), [tagState]);
  const excludeTags = useMemo(() => Object.keys(tagState).filter((k) => tagState[k] === -1).map(normalize), [tagState]);

  const allTags = useMemo(() => {
    const channelPool = selectedChannels.length ? channels.filter((ch) => selectedChannels.includes(ch.code) || selectedChannels.includes(ch.name)) : channels;
    const fromChannels = channelPool.flatMap((ch) => ch.availableTags || []);
    const postsPool = posts.filter(
      (p) => !selectedChannels.length || selectedChannels.includes(p.channel.code) || selectedChannels.includes(p.channel.name),
    );
    const fromEntryRefs = postsPool.flatMap((p) => p.entry.tags || []);
    const names = Array.from(new Set([...fromChannels, ...fromEntryRefs]));
    let tags = sortTagObjectsForDisplay(names.map((n) => ({ id: n, name: n })));
    if (!selectedChannels.length) {
      tags = tags.filter((tag) => !!getSpecialTagMeta(tag.name));
    }
    return tags;
  }, [channels, posts, selectedChannels]);

  const filteredPosts = useMemo(
    () => filterPosts(posts, { q, includeTags, excludeTags, selectedChannels, sortKey, tagMode }),
    [posts, q, includeTags, excludeTags, selectedChannels, sortKey, tagMode],
  );

  const channelCounts = useMemo(
    () => computeChannelCounts(posts, includeTags, excludeTags, tagMode, q),
    [posts, includeTags, excludeTags, tagMode, q],
  );
  const tagCounts = useMemo(() => computeTagCounts(posts, selectedChannels, excludeTags, q), [posts, selectedChannels, excludeTags, q]);

  const handleOpenPost = (p: ArchiveListItem) => {
    sessionStorage.setItem("archive-scroll", `${window.scrollY}`);
    router.push(`/archives/${p.slug}`);
  };

  const resetFilters = () => {
    setSelectedChannels([]);
    setTagState({});
    setTagMode("AND");
    setQ("");
    setSortKey("newest");
  };

  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setClientReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const commitSearch = () => setQ((val) => val);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <HeaderBar
        owner={owner}
        repo={repo}
        branch={branch}
        siteName={siteConfig.siteName}
        view="archive"
        logoSrc={siteConfig.logoSrc}
        discordInviteUrl={siteConfig.discordInviteUrl}
        q={q}
        onSearchChange={setQ}
        onSearchCommit={commitSearch}
        sortKey={sortKey}
        onSortChange={(val) => setSortKey(val)}
        dictionaryQuery={dictionaryQuery}
        onDictionarySearchChange={setDictionaryQuery}
        dictionarySort={dictionarySort}
        onDictionarySortChange={setDictionarySort}
        onArchiveClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onDictionaryClick={() => {}}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 pb-12 pt-4 lg:flex-row lg:items-start lg:px-4">
        <aside className="sidebar-scroll lg:sticky lg:top-16 lg:w-72 xl:w-80">
          <div className="sidebar-scroll-inner lg:max-h-[calc(100vh-130px)]">
            <div className="rounded-xl border bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <ArchiveFilters
                channels={channels}
                selectedChannels={selectedChannels}
                channelCounts={channelCounts}
                onToggleChannel={(code) =>
                  setSelectedChannels((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
                }
                onResetFilters={resetFilters}
              />
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col gap-4 lg:pt-1.5">
          {error ? <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          {loading ? <div className="rounded-lg border bg-white p-3 text-sm dark:bg-gray-900">Updating repository index…</div> : null}

          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
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
              {allTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  state={tagState[tag.name] || 0}
                  count={tagCounts[normalize(tag.name)] || 0}
                  onToggle={() => {
                    setTagState((prev) => {
                      const cur = prev[tag.name] || 0;
                      const next = cur === 0 ? 1 : cur === 1 ? -1 : 0;
                      return { ...prev, [tag.name]: next };
                    });
                  }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span>
                Showing {filteredPosts.length} of {posts.length} posts
              </span>
              <button onClick={resetFilters} className="text-blue-600 hover:underline dark:text-blue-400">
                Reset filters
              </button>
            </div>
          </div>

          {clientReady ? (
            <VirtualizedGrid posts={filteredPosts} sortKey={sortKey} ensurePostLoaded={ensurePostLoaded} onNavigate={handleOpenPost} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <PostCard
                  key={`${post.channel.path}/${post.entry.path}`}
                  post={post}
                  sortKey={sortKey}
                  ensurePostLoaded={ensurePostLoaded}
                  onNavigate={handleOpenPost}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
