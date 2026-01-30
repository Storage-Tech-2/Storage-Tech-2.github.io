'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import {
  findPostBySlug,
  getCachedDictionaryIndex,
  prefetchArchiveEntryData,
  prefetchDictionaryIndex,
  type ArchiveListItem,
} from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";
import { getArchiveSlugInfo, getURLFromMouseEvent } from "@/lib/utils/urls";
import type { ArchiveEntryData, IndexedDictionaryEntry } from "@/lib/types";
import { buildHistoryState } from "@/lib/urlState";

type Options = {
  posts: ArchiveListItem[];
  archiveRootHref: string;
  pendingScrollRef: RefObject<number | null>;
};

const buildDictionaryTooltips = (entries: IndexedDictionaryEntry[] | null) => {
  if (!entries?.length) return {};
  const tooltips: Record<string, string> = {};
  entries.forEach((entry) => {
    const summary = entry.index.summary?.trim();
    if (summary) tooltips[entry.index.id] = summary;
  });
  return tooltips;
};

const isPlainLeftClick = (event?: MouseEvent<HTMLAnchorElement>) => {
  if (!event) return true;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
};

const extractArchiveSlugFromUrl = (url: URL) => getArchiveSlugInfo(url).slug;

const getCurrentHref = () => {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const syncDocumentTitle = (post: ArchiveListItem | null, titleRef: React.MutableRefObject<string | null>) => {
  if (typeof document === "undefined") return;
  if (!post) {
    if (titleRef.current !== null) {
      document.title = titleRef.current;
      titleRef.current = null;
    }
    return;
  }
  if (titleRef.current === null) {
    titleRef.current = document.title;
  }
  document.title = `${post.entry.name} | ${siteConfig.siteName}`;
};

export function useArchivePostShell({ posts, archiveRootHref, pendingScrollRef }: Options) {
  const [openPost, setOpenPost] = useState<ArchiveListItem | null>(null);
  const [openData, setOpenData] = useState<ArchiveEntryData | null>(null);
  const [openDictionaryTooltips, setOpenDictionaryTooltips] = useState<Record<string, string>>({});
  const [openError, setOpenError] = useState<string | null>(null);
  const openRequestRef = useRef<symbol | null>(null);
  const listUrlRef = useRef<string | null>(null);
  const openScrollRef = useRef<number | null>(null);
  const titleRef = useRef<string | null>(null);

  useEffect(() => {
    syncDocumentTitle(openPost, titleRef);
  }, [openPost]);

  const resetOpenState = useCallback((restoreScroll: boolean) => {
    setOpenPost(null);
    setOpenData(null);
    setOpenError(null);
    openRequestRef.current = null;
    setOpenDictionaryTooltips({});
    if (openScrollRef.current !== null && restoreScroll) {
      pendingScrollRef.current = openScrollRef.current;
    }
    openScrollRef.current = null;
  }, [pendingScrollRef]);

  const loadPost = useCallback((post: ArchiveListItem) => {
    setOpenPost(post);
    setOpenData(null);
    setOpenError(null);
    const requestToken = Symbol("archive-entry");
    openRequestRef.current = requestToken;
    const cachedDictionary = getCachedDictionaryIndex()?.index ?? null;
    if (cachedDictionary) {
      setOpenDictionaryTooltips(buildDictionaryTooltips(cachedDictionary.entries));
    }
    Promise.all([prefetchArchiveEntryData(post), prefetchDictionaryIndex()])
      .then(([postData, dictionary]) => {
        if (openRequestRef.current !== requestToken) return;
        if (dictionary?.entries?.length) {
          setOpenDictionaryTooltips(buildDictionaryTooltips(dictionary.entries));
        }
        if (postData) {
          setOpenData(postData);
          setOpenError(null);
        } else {
          setOpenError("We could not load this entry.");
        }
      })
      .catch((err) => {
        if (openRequestRef.current !== requestToken) return;
        setOpenError((err as Error).message || "Unable to load this entry.");
      });
  }, []);

  const openPostFromList = useCallback((post: ArchiveListItem, event?: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return false;
    if (typeof window === "undefined") return true;
    const currentHref = getCurrentHref();
    if (!openPost) {
      listUrlRef.current = currentHref;
      openScrollRef.current = window.scrollY;
      sessionStorage.setItem("archive-scroll", `${window.scrollY}`);
    }
    pendingScrollRef.current = null;
    const nextHref = `${archiveRootHref}/${encodeURIComponent(post.slug)}`;
    const nextState = buildHistoryState({
      archiveListHref: listUrlRef.current || currentHref
    });
    window.history.pushState(nextState, "", nextHref);
    requestAnimationFrame(() => window.scrollTo(0, 0));
    loadPost(post);
    return true;
  }, [archiveRootHref, loadPost, openPost, pendingScrollRef]);

  const onLinkClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    const url = getURLFromMouseEvent(event);
    if (!url) return;
    const slug = extractArchiveSlugFromUrl(url);
    if (!slug) return;
    const match = findPostBySlug(posts, slug);
    if (!match) return;
    openPostFromList(match);
    event.preventDefault();
  }, [openPostFromList, posts]);

  const openPostFromUrl = useCallback((post: ArchiveListItem) => {
    if (openPost?.slug === post.slug) return;
    if (typeof window !== "undefined" && !listUrlRef.current) {
      const historyState = window.history.state as { archiveListHref?: string } | null;
      listUrlRef.current = historyState?.archiveListHref || archiveRootHref;
    }
    pendingScrollRef.current = null;
    loadPost(post);
  }, [archiveRootHref, loadPost, openPost, pendingScrollRef]);

  const closePostFromUrl = useCallback(() => {
    if (!openPost) return;
    resetOpenState(true);
  }, [openPost, resetOpenState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromLocation = () => {
      const slug = extractArchiveSlugFromUrl(new URL(window.location.href));
      if (!slug) {
        closePostFromUrl();
        return;
      }
      const match = findPostBySlug(posts, slug);
      if (!match) return;
      openPostFromUrl(match);
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("pageshow", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("pageshow", syncFromLocation);
    };
  }, [closePostFromUrl, openPostFromUrl, posts]);

  return {
    openPost,
    openData,
    openDictionaryTooltips,
    openError,
    isPostOpen: Boolean(openPost),
    openPostFromList,
    onLinkClick,
  };
}
