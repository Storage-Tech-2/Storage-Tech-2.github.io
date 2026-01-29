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
import type { ArchiveEntryData, IndexedDictionaryEntry } from "@/lib/types";

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

const extractArchiveSlugFromUrl = (url: URL) => {
  const basePath = siteConfig.basePath || "";
  const rawPath = url.pathname;
  const normalizedPath = basePath && rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath;
  if (!normalizedPath.startsWith("/archives/")) return null;
  const slug = normalizedPath.replace("/archives/", "").replace(/\/+$/, "");
  if (!slug) return null;
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
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
    if (typeof document === "undefined") return;
    if (!openPost) {
      if (titleRef.current !== null) {
        document.title = titleRef.current;
        titleRef.current = null;
      }
      return;
    }
    if (titleRef.current === null) {
      titleRef.current = document.title;
    }
    document.title = `${openPost.entry.name} | ${siteConfig.siteName}`;
  }, [openPost]);

  const closePost = useCallback(() => {
    if (typeof window === "undefined") return;
    const listHref = listUrlRef.current || archiveRootHref;
    window.history.replaceState(window.history.state, "", listHref);
    listUrlRef.current = null;
    setOpenPost(null);
    setOpenData(null);
    setOpenError(null);
    openRequestRef.current = null;
    setOpenDictionaryTooltips({});
    if (openScrollRef.current !== null) {
      pendingScrollRef.current = openScrollRef.current;
      openScrollRef.current = null;
    }
  }, [archiveRootHref, pendingScrollRef]);

  const openPostFromList = useCallback((post: ArchiveListItem, event?: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return false;
    if (typeof window === "undefined") return true;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!openPost) {
      listUrlRef.current = currentHref;
      openScrollRef.current = window.scrollY;
      sessionStorage.setItem("archive-scroll", `${window.scrollY}`);
    }
    pendingScrollRef.current = null;
    const nextHref = `${archiveRootHref}/${encodeURIComponent(post.slug)}`;
    window.history.pushState(window.history.state, "", nextHref);
    requestAnimationFrame(() => window.scrollTo(0, 0));
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
      })
    return true;
  }, [archiveRootHref, openPost, pendingScrollRef]);

  const handleArchiveUrlNavigate = useCallback((url: URL) => {
    const slug = extractArchiveSlugFromUrl(url);
    if (!slug) return false;
    const match = findPostBySlug(posts, slug);
    if (!match) return false;
    openPostFromList(match);
    return true;
  }, [openPostFromList, posts]);

  return {
    openPost,
    openData,
    openDictionaryTooltips,
    openError,
    isPostOpen: Boolean(openPost),
    openPostFromList,
    closePost,
    handleArchiveUrlNavigate,
  };
}
