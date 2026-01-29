'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { computeAuthorCounts, computeChannelCounts, computeTagCounts, filterPosts, getPostAuthorsNormalized } from "@/lib/filtering";
import { type ArchiveListItem } from "@/lib/archive";
import { DEFAULT_GLOBAL_TAGS, type ChannelRef, type GlobalTag, type SortKey, type Tag } from "@/lib/types";
import { normalize } from "@/lib/utils/strings";
import { getSpecialTagMeta, sortTagObjectsForDisplay } from "@/lib/utils/tagDisplay";
import { disablePagination } from "@/lib/runtimeFlags";
import {
  getArchiveFiltersFromUrl,
  readArchiveSession,
  setArchiveFiltersToUrl,
  writeArchiveSession,
} from "@/lib/urlState";
import { setInternalNavigationFlag } from "@/hooks/useBackNavigation";

type AuthorOption = {
  name: string;
  norm: string;
  count: number;
  selected: boolean;
};

type Options = {
  posts: ArchiveListItem[];
  channels: ChannelRef[];
  globalTags: GlobalTag[];
  pageNumber: number;
  pageSize: number;
  pageCount?: number;
  isPostOpen: boolean;
  hydrated: boolean;
};

export function useArchiveFilters({
  posts,
  channels,
  globalTags,
  pageNumber,
  pageSize,
  pageCount,
  isPostOpen,
  hydrated,
}: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [committedQ, setCommittedQ] = useState("");
  const [tagMode, setTagMode] = useState<"OR" | "AND">("AND");
  const [tagState, setTagState] = useState<Record<string, -1 | 0 | 1>>({});
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [authorQuery, setAuthorQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [dictionaryQuery, setDictionaryQuery] = useState("");
  const [dictionarySort, setDictionarySort] = useState<"az" | "updated">("az");
  const skipUrlSyncRef = useRef(true);

  useEffect(() => {
    const hasUrlState = (state: ReturnType<typeof getArchiveFiltersFromUrl>) =>
      state.committedQ ||
      state.sortKey !== "newest" ||
      state.tagMode !== "AND" ||
      Object.keys(state.tagState).length > 0 ||
      state.selectedChannels.length > 0 ||
      state.selectedAuthors.length > 0;
    const fromUrl = getArchiveFiltersFromUrl();
    const fromSession = hasUrlState(fromUrl) ? null : readArchiveSession();
    const next = fromSession
      ? {
        q: fromSession.q || "",
        committedQ: fromSession.committedQ ?? fromSession.q ?? "",
        tagMode: (fromSession.tagMode === "OR" ? "OR" : "AND") as "OR" | "AND",
        tagState: fromSession.tagState || {},
        selectedChannels: fromSession.selectedChannels || [],
        selectedAuthors: fromSession.selectedAuthors || [],
        sortKey: fromSession.sortKey || "newest",
      }
      : fromUrl;
    startTransition(() => {
      setQ(next.q || "");
      setCommittedQ(next.committedQ || "");
      setTagMode(next.tagMode);
      setTagState(next.tagState || {});
      setSelectedChannels(next.selectedChannels || []);
      setSelectedAuthors(next.selectedAuthors || []);
      setSortKey(next.sortKey || "newest");
    });
    setInternalNavigationFlag();
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
        setSelectedAuthors(parsed.selectedAuthors || []);
        setSortKey(parsed.sortKey || "newest");
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (skipUrlSyncRef.current) return;
    if (isPostOpen) return;
    setArchiveFiltersToUrl(router, {
      q,
      committedQ,
      tagMode,
      tagState,
      selectedChannels,
      selectedAuthors,
      sortKey,
    }, pathname);
  }, [committedQ, sortKey, tagMode, tagState, selectedChannels, selectedAuthors, q, router, pathname, isPostOpen]);

  useEffect(() => {
    if (skipUrlSyncRef.current) return;
    if (typeof window === "undefined") return;
    writeArchiveSession({
      q,
      committedQ,
      tagMode,
      tagState,
      selectedChannels,
      selectedAuthors,
      sortKey,
    });
  }, [q, committedQ, tagMode, tagState, selectedChannels, selectedAuthors, sortKey]);

  useEffect(() => {
    skipUrlSyncRef.current = false;
  }, []);

  const commitSearch = () => setCommittedQ(q);

  const includeTags = useMemo(() => Object.keys(tagState).filter((k) => tagState[k] === 1).map(normalize), [tagState]);
  const excludeTags = useMemo(() => Object.keys(tagState).filter((k) => tagState[k] === -1).map(normalize), [tagState]);
  const normalizedSelectedAuthors = useMemo(() => selectedAuthors.map(normalize), [selectedAuthors]);

  const allTags = useMemo<Tag[]>(() => {
    const channelPool = selectedChannels.length ? channels.filter((ch) => selectedChannels.includes(ch.code) || selectedChannels.includes(ch.name)) : channels;
    const fromChannels = channelPool.flatMap((ch) => ch.availableTags || []);
    const authorSet = normalizedSelectedAuthors.length ? new Set(normalizedSelectedAuthors) : null;
    const postsPool = posts.filter((p) => {
      const matchesChannel =
        !selectedChannels.length || selectedChannels.includes(p.channel.code) || selectedChannels.includes(p.channel.name);
      if (!matchesChannel) return false;
      if (!authorSet) return true;
      const authors = getPostAuthorsNormalized(p);
      return authors.some((a) => authorSet.has(a));
    });
    const fromEntryRefs = postsPool.flatMap((p) => p.entry.tags || []);
    const fromGlobals = (globalTags?.length ? globalTags : DEFAULT_GLOBAL_TAGS).map((tag) => tag.name);
    const names = Array.from(new Set([...fromGlobals, ...fromChannels, ...fromEntryRefs]));
    let tags = sortTagObjectsForDisplay(names.map((n) => ({ id: n, name: n })), globalTags);
    if (!selectedChannels.length && !selectedAuthors.length) {
      tags = tags.filter((tag) => !!getSpecialTagMeta(tag.name, globalTags));
    }
    return tags;
  }, [channels, posts, selectedAuthors.length, selectedChannels, normalizedSelectedAuthors, globalTags]);

  const availableAuthors = useMemo(() => {
    const map = new Map<string, string>();
    posts.forEach((p) => {
      (p.entry.authors || []).forEach((name) => {
        const norm = normalize(name);
        if (!map.has(norm)) map.set(norm, name);
      });
    });
    selectedAuthors.forEach((name) => {
      const norm = normalize(name);
      if (!map.has(norm)) map.set(norm, name);
    });
    return Array.from(map.values());
  }, [posts, selectedAuthors]);

  const authorCounts = useMemo(
    () => computeAuthorCounts(posts, selectedChannels, includeTags, excludeTags, tagMode, q),
    [posts, selectedChannels, includeTags, excludeTags, tagMode, q],
  );

  const authorSearchTerm = useMemo(() => authorQuery.trim().toLowerCase(), [authorQuery]);
  const authorOptions = useMemo<AuthorOption[]>(() => {
    const selectedSet = new Set(normalizedSelectedAuthors);
    return availableAuthors
      .map((name) => {
        const norm = normalize(name);
        return { name, norm, count: authorCounts[norm] || 0, selected: selectedSet.has(norm) };
      })
      .filter((opt) => {
        if (opt.selected) return true;
        const hasMatches = (opt.count || 0) > 0;
        if (!hasMatches) return false;
        if (!authorSearchTerm) return true;
        return opt.norm.includes(authorSearchTerm);
      })
      .sort((a, b) => {
        if (a.selected !== b.selected) return a.selected ? -1 : 1;
        if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0);
        return a.name.localeCompare(b.name);
      });
  }, [availableAuthors, authorCounts, normalizedSelectedAuthors, authorSearchTerm]);

  const filteredPosts = useMemo(
    () => filterPosts(posts, { q, includeTags, excludeTags, selectedChannels, selectedAuthors, sortKey, tagMode }),
    [posts, q, includeTags, excludeTags, selectedChannels, selectedAuthors, sortKey, tagMode],
  );

  const pageTotal = pageCount ?? 0;
  const showPagination = !disablePagination && pageTotal > 1 && (pageNumber > 0 || !hydrated);

  const pagedPosts = useMemo(() => {
    const start = Math.max(0, Math.max(pageNumber - 1, 0) * pageSize);
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, pageNumber, pageSize]);

  const pagination = showPagination ? (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-300">
      {pageNumber > 1 ? (
        <a
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          href={`/archives/page/${pageNumber - 1}`}
        >
          ← Previous
        </a>
      ) : (
        <span className="rounded-full border border-transparent px-3 py-1 text-sm font-semibold text-gray-400">← Previous</span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: pageTotal }, (_, i) => {
          const page = i + 1;
          const href = `/archives/page/${page}`;
          return (page === pageNumber || (page === 1 && pageNumber === 0)) ? (
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
      {pageNumber < pageTotal ? (
        <a
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          href={`/archives/page/${pageNumber + 1}`}
        >
          Next →
        </a>
      ) : (
        <span className="rounded-full border border-transparent px-3 py-1 text-sm font-semibold text-gray-400">Next →</span>
      )}
    </div>
  ) : null;

  const channelCounts = useMemo(
    () => computeChannelCounts(posts, includeTags, excludeTags, tagMode, q, selectedAuthors),
    [posts, includeTags, excludeTags, selectedAuthors, tagMode, q],
  );
  const tagCounts = useMemo(
    () => computeTagCounts(posts, selectedChannels, excludeTags, q, selectedAuthors),
    [posts, selectedChannels, excludeTags, q, selectedAuthors],
  );

  const handleToggleTag = (tagName: string, rightClick: boolean) => {
    setTagState((prev) => {
      const cur = prev[tagName] || 0;
      const next = rightClick ? (cur === -1 ? 0 : -1) : cur === 1 ? 0 : 1;
      return { ...prev, [tagName]: next };
    });
  };

  const toggleAuthor = (name: string) => {
    setSelectedAuthors((prev) => {
      const norm = normalize(name);
      const exists = prev.some((a) => normalize(a) === norm);
      if (exists) return prev.filter((a) => normalize(a) !== norm);
      return [...prev, name];
    });
  };

  const clearAuthors = () => {
    setSelectedAuthors([]);
    setAuthorQuery("");
  };

  const resetFilters = () => {
    setSelectedChannels([]);
    setSelectedAuthors([]);
    setAuthorQuery("");
    setTagState({});
    setTagMode("AND");
    setQ("");
    setCommittedQ("");
    setSortKey("newest");
  };

  return {
    search: {
      q,
      setQ,
      commitSearch,
    },
    tags: {
      mode: tagMode,
      setMode: setTagMode,
      state: tagState,
      setState: setTagState,
      all: allTags,
      counts: tagCounts,
      toggle: handleToggleTag,
    },
    channels: {
      selected: selectedChannels,
      setSelected: setSelectedChannels,
      counts: channelCounts,
      toggle: (code: string) =>
        setSelectedChannels((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code])),
    },
    authors: {
      query: authorQuery,
      setQuery: setAuthorQuery,
      options: authorOptions,
      toggle: toggleAuthor,
      clear: clearAuthors,
      selected: selectedAuthors,
      setSelected: setSelectedAuthors,
    },
    sort: {
      key: sortKey,
      setKey: setSortKey,
    },
    dictionary: {
      query: dictionaryQuery,
      setQuery: setDictionaryQuery,
      sort: dictionarySort,
      setSort: setDictionarySort,
    },
    results: {
      filtered: filteredPosts,
      paged: pagedPosts,
    },
    pagination: {
      show: showPagination,
      node: pagination,
    },
    reset: resetFilters,
    includeTags,
    excludeTags,
  };
}

export type ArchiveFiltersModel = ReturnType<typeof useArchiveFilters>;
