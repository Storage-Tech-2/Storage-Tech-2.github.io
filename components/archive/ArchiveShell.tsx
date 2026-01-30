'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { HeaderBar } from "../layout/HeaderBar";
import { ArchivePostView } from "./ArchivePostView";
import { ArchiveListView } from "./ArchiveListView";
import { useArchiveData } from "@/hooks/useArchiveData";
import { useArchiveFilters } from "@/hooks/useArchiveFilters";
import { useArchivePostShell } from "@/hooks/useArchivePostShell";
import { type ArchiveIndex } from "@/lib/archive";
import { DEFAULT_GLOBAL_TAGS, type GlobalTag } from "@/lib/types";
import { siteConfig } from "@/lib/siteConfig";
import { Footer } from "@/components/layout/Footer";
import { getHistoryState } from "@/lib/urlState";

type Props = {
  initialArchive: ArchiveIndex;
  pageNumber: number;
  pageSize: number;
  pageCount?: number;
};

let hasHydratedArchiveShell = false;

export function ArchiveShell({
  initialArchive,
  pageNumber = 0,
  pageSize,
  pageCount,
}: Props) {

  const [hydrated, setHydrated] = useState(hasHydratedArchiveShell);
  useEffect(() => {
    hasHydratedArchiveShell = true;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setHydrated(true);
  }, []);


  const { posts, channels, error, config } = useArchiveData({ initial: initialArchive });
  const archiveConfig = config ?? initialArchive.config;
  const globalTags = useMemo<GlobalTag[]>(
    () => archiveConfig.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS,
    [archiveConfig.globalTags],
  );
  const sidebarShellRef = useRef<HTMLElement | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const archiveRootHref = `${siteConfig.basePath || ""}/archives`;


  const {
    openPost,
    openData,
    openDictionaryTooltips,
    openError,
    isPostOpen,
    openPostFromList,
    onLinkClick,
    goHome,
  } = useArchivePostShell({ posts, archiveRootHref, pendingScrollRef });

  const filters = useArchiveFilters({
    posts,
    channels,
    globalTags,
    pageNumber,
    pageSize,
    pageCount,
    isPostOpen,
    hydrated,
  });

  useEffect(() => {
    const el = sidebarShellRef.current;
    if (!el) return;
    if (el.scrollTop !== 0) el.scrollTo({ top: 0 });
  }, [
    filters.authors.selected,
    filters.channels.selected,
    filters.tags.state,
    filters.tags.mode,
    filters.results.filtered.length,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const captureScroll = () => {
      const state = getHistoryState();
      const y = state.archiveListScrollY;
      if (typeof y !== "number" || Number.isNaN(y)) return;
      pendingScrollRef.current = y;
    };
    const restoreScroll = () => {
      if (!hydrated || isPostOpen) return;
      const y = pendingScrollRef.current;
      if (y === null) return;
      requestAnimationFrame(() => window.scrollTo(0, y));
      pendingScrollRef.current = null;
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
  }, [hydrated, isPostOpen, pendingScrollRef]);

  useEffect(() => {
    if (!hydrated || isPostOpen) return;
    if (pendingScrollRef.current === null) return;
    requestAnimationFrame(() => {
      const y = pendingScrollRef.current;
      if (y === null) return;
      window.scrollTo(0, y);
      pendingScrollRef.current = null;
    });
  }, [hydrated, isPostOpen, pendingScrollRef, filters.results.filtered.length]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">

      {!isPostOpen ? (
        <HeaderBar
          siteName={siteConfig.siteName}
          view="archive"
          logoSrc={siteConfig.logoSrc}
          discordInviteUrl={siteConfig.discordInviteUrl}
          filters={filters}
        />
      ) : null}

      {isPostOpen ? (
        <ArchivePostView
          post={openPost}
          data={openData}
          dictionaryTooltips={openDictionaryTooltips}
          error={openError}
          globalTags={globalTags}
          archiveConfig={archiveConfig}
          onLinkClick={onLinkClick}
          goHome={goHome}
        />
      ) : null}

      <ArchiveListView
        visible={!isPostOpen}
        sidebarRef={sidebarShellRef}
        channelsList={channels}
        filters={filters}
        error={error}
        globalTags={globalTags}
        pageSize={pageSize}
        pageNumber={pageNumber}
        hydrated={hydrated}
        totalPosts={posts.length}
        onNavigate={(post, event) => {
          filters.search.commitSearch();
          return openPostFromList(post, event);
        }}
      />


      <Footer />
    </div>
  );
}
