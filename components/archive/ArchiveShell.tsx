'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
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
import { Footer } from "@/components/layout/Footer";
import {
  getArchiveFiltersFromUrl,
  readArchiveSession,
  setArchiveFiltersToUrl,
  writeArchiveSession,
} from "@/lib/urlState";
import { buildDictionarySlug } from "@/lib/dictionary";
import { disableInfiniteScroll, disablePagination } from "@/lib/runtimeFlags";

type Props = {
  initialArchive: ArchiveIndex;
  initialDictionary: { entries: IndexedDictionaryEntry[] };
  owner?: string;
  repo?: string;
  branch?: string;
  pageNumber?: number;
  pageSize?: number;
  pageCount?: number;
};

export function ArchiveShell({
  initialArchive,
  initialDictionary,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  pageNumber = 1,
  pageSize,
  pageCount,
}: Props) {
  const router = useRouter();
  const { posts, channels, error, ensurePostLoaded } = useArchiveData({ initial: initialArchive, owner, repo, branch });
  const { entries: dictionaryEntries } = useDictionaryData({
    initial: initialDictionary,
    owner,
    repo,
    branch,
  });

  const [q, setQ] = useState("");
  const [committedQ, setCommittedQ] = useState("");
  const [tagMode, setTagMode] = useState<"OR" | "AND">("AND");
  const [tagState, setTagState] = useState<Record<string, -1 | 0 | 1>>({});
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [dictionaryQuery, setDictionaryQuery] = useState("");
  const [dictionarySort, setDictionarySort] = useState<"az" | "updated">("az");
  const sidebarShellRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const hasUrlState = (state: ReturnType<typeof getArchiveFiltersFromUrl>) =>
      state.committedQ ||
      state.sortKey !== "newest" ||
      state.tagMode !== "AND" ||
      Object.keys(state.tagState).length > 0 ||
      state.selectedChannels.length > 0;
    const fromUrl = getArchiveFiltersFromUrl();
    const fromSession = hasUrlState(fromUrl) ? null : readArchiveSession();
    const next = fromSession
      ? {
          q: fromSession.q || "",
          committedQ: fromSession.committedQ ?? fromSession.q ?? "",
          tagMode: (fromSession.tagMode === "OR" ? "OR" : "AND") as "OR" | "AND",
          tagState: fromSession.tagState || {},
          selectedChannels: fromSession.selectedChannels || [],
          sortKey: fromSession.sortKey || "newest",
        }
      : fromUrl;
    startTransition(() => {
      setQ(next.q || "");
      setCommittedQ(next.committedQ || "");
      setTagMode(next.tagMode);
      setTagState(next.tagState || {});
      setSelectedChannels(next.selectedChannels || []);
      setSortKey(next.sortKey || "newest");
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const parsed = getArchiveFiltersFromUrl();
      startTransition(() => {
        setQ(parsed.q || "");
        setCommittedQ(parsed.committedQ || "");
        setTagMode(parsed.tagMode);
        setTagState(parsed.tagState || {});
        setSelectedChannels(parsed.selectedChannels || []);
        setSortKey(parsed.sortKey || "newest");
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const pendingScrollRef = useRef<number | null>(null);
  const legacyRedirectHandledRef = useRef(false);

  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setClientReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const commitSearch = () => setCommittedQ(q);

  useEffect(() => {
    if (legacyRedirectHandledRef.current) return;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const legacyId = sp.get("id");
    const legacyDid = sp.get("did");
    if (!legacyId && !legacyDid) return;
    if (legacyId) {
      const found = posts.find(
        (p) => p.entry.id === legacyId || p.entry.code === legacyId || p.slug.toLowerCase() === legacyId.toLowerCase(),
      );
      if (found) {
        legacyRedirectHandledRef.current = true;
        router.replace(`/archives/${found.slug}`);
        return;
      }
    }
    if (legacyDid) {
      const entry = dictionaryEntries.find((e) => e.index.id === legacyDid);
      if (entry) {
        legacyRedirectHandledRef.current = true;
        const slug = buildDictionarySlug(entry.index);
        router.replace(`/dictionary/${encodeURIComponent(slug)}`);
      }
    }
  }, [posts, dictionaryEntries, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const captureScroll = () => {
      const savedScroll = sessionStorage.getItem("archive-scroll");
      if (!savedScroll) return;
      const y = parseInt(savedScroll, 10);
      if (!Number.isNaN(y)) pendingScrollRef.current = y;
    };
    const restoreScroll = () => {
      if (!clientReady) return;
      const y = pendingScrollRef.current;
      if (y === null) return;
      requestAnimationFrame(() => window.scrollTo(0, y));
      pendingScrollRef.current = null;
      sessionStorage.removeItem("archive-scroll");
    };
    captureScroll();
    restoreScroll();
    window.addEventListener("popstate", captureScroll);
    window.addEventListener("popstate", restoreScroll);
    window.addEventListener("pageshow", captureScroll);
    window.addEventListener("pageshow", restoreScroll);
    return () => {
      window.removeEventListener("popstate", captureScroll);
      window.removeEventListener("popstate", restoreScroll);
      window.removeEventListener("pageshow", captureScroll);
      window.removeEventListener("pageshow", restoreScroll);
    };
  }, [clientReady]);

  useEffect(() => {
    setArchiveFiltersToUrl({
      q,
      committedQ,
      tagMode,
      tagState,
      selectedChannels,
      sortKey,
    });
  }, [committedQ, sortKey, tagMode, tagState, selectedChannels, q]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    writeArchiveSession({
      q,
      committedQ,
      tagMode,
      tagState,
      selectedChannels,
      sortKey,
    });
  }, [q, committedQ, tagMode, tagState, selectedChannels, sortKey]);

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
  const pagedPosts = useMemo(() => {
    if (!pageSize) return filteredPosts;
    const start = Math.max(0, (pageNumber - 1) * pageSize);
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, pageNumber, pageSize]);
  const clientPosts = useMemo(
    () => (disableInfiniteScroll && pageSize ? pagedPosts : filteredPosts),
    [pageSize, pagedPosts, filteredPosts],
  );
  const [clientHidePagination, setClientHidePagination] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setClientHidePagination(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const showPagination = !disablePagination && !!pageCount && pageCount > 1 && !clientHidePagination;

  const pagination = showPagination ? (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-300">
      {pageNumber > 1 ? (
        <a
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          href={pageNumber === 2 ? "/" : `/page/${pageNumber - 1}`}
        >
          ← Previous
        </a>
      ) : (
        <span className="rounded-full border border-transparent px-3 py-1 text-sm font-semibold text-gray-400">← Previous</span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: pageCount }, (_, i) => {
          const page = i + 1;
          const href = page === 1 ? "/" : `/page/${page}`;
          return page === pageNumber ? (
            <span
              key={page}
              className="rounded-full border border-blue-500 bg-blue-500 px-3 py-1 text-xs font-semibold text-white shadow-sm"
              aria-current="page"
            >
              {page}
            </span>
          ) : (
            <a
              key={page}
              className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800"
              href={href}
            >
              {page}
            </a>
          );
        })}
      </div>
      {pageNumber < pageCount ? (
        <a
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          href={`/page/${pageNumber + 1}`}
        >
          Next →
        </a>
      ) : (
        <span className="rounded-full border border-transparent px-3 py-1 text-sm font-semibold text-gray-400">Next →</span>
      )}
    </div>
  ) : null;

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
    setCommittedQ("");
    setSortKey("newest");
  };

  useEffect(() => {
    const el = sidebarShellRef.current;
    if (el && el.scrollTop !== 0) el.scrollTop = 0;
  }, [selectedChannels, tagState, tagMode, filteredPosts.length]);

  useEffect(() => {
    if (!clientReady) return;
    if (pendingScrollRef.current === null) return;
    requestAnimationFrame(() => {
      const y = pendingScrollRef.current;
      if (y === null) return;
      window.scrollTo(0, y);
      pendingScrollRef.current = null;
    });
  }, [clientReady, filteredPosts.length]);

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

      <div className="mx-auto w-full px-2 pb-16 pt-4 sm:px-4 lg:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 lg:min-h-screen">
          <aside ref={sidebarShellRef} className="lg:w-80 xl:w-96 shrink-0 lg:sticky lg:top-24 pr-1 sidebar-scroll">
            <div className="sidebar-scroll-inner lg:max-h-[calc(100vh-80px)]">
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
          </aside>

          <div className="flex-1 lg:pt-1.5">
          {error ? <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          {/* {loading ? <div className="rounded-lg border bg-white p-3 text-sm dark:bg-gray-900">Updating repository index…</div> : null} */}

          <div>
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
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span>
                Showing {filteredPosts.length} of {posts.length} posts
              </span>
            </div>
          </div>

            {clientReady ? (
              <>
                <VirtualizedGrid posts={clientPosts} sortKey={sortKey} ensurePostLoaded={ensurePostLoaded} onNavigate={handleOpenPost} />
                {pagination}
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pagedPosts.map((post) => (
                    <PostCard
                      key={`${post.channel.path}/${post.entry.path}`}
                      post={post}
                      sortKey={sortKey}
                      ensurePostLoaded={ensurePostLoaded}
                      onNavigate={handleOpenPost}
                    />
                  ))}
                </div>
                {pagination}
              </>
            )}

          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
