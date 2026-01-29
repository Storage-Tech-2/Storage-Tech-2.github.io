'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { HeaderBar } from "../layout/HeaderBar";
import { ArchivePostView } from "./ArchivePostView";
import { ArchiveListView } from "./ArchiveListView";
import { useArchiveData } from "@/hooks/useArchiveData";
import { useArchiveFilters } from "@/hooks/useArchiveFilters";
import { useArchivePostShell } from "@/hooks/useArchivePostShell";
import { useArchiveScrollRestore } from "@/hooks/useArchiveScrollRestore";
import { type ArchiveIndex } from "@/lib/archive";
import { DEFAULT_GLOBAL_TAGS, type GlobalTag } from "@/lib/types";
import { siteConfig } from "@/lib/siteConfig";
import { Footer } from "@/components/layout/Footer";

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
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    hasHydratedArchiveShell = true;
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
    closePost,
    handleArchiveUrlNavigate,
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

  useArchiveScrollRestore({
    pendingScrollRef,
    hydrated,
    isPostOpen,
    restoreKey: filters.results.filtered.length,
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {isPostOpen ? (
        <ArchivePostView
          post={openPost}
          data={openData}
          dictionaryTooltips={openDictionaryTooltips}
          error={openError}
          globalTags={globalTags}
          archiveConfig={archiveConfig}
          onClose={closePost}
          onArchiveNavigate={handleArchiveUrlNavigate}
        />
      ) : (
        <>
          <HeaderBar
            siteName={siteConfig.siteName}
            view="archive"
            logoSrc={siteConfig.logoSrc}
            discordInviteUrl={siteConfig.discordInviteUrl}
            filters={filters}
          />
          <ArchiveListView
            sidebarRef={sidebarShellRef}
            channelsList={channels}
            filters={filters}
            error={error}
            globalTags={globalTags}
            pageSize={pageSize}
            pageNumber={pageNumber}
            hydrated={hydrated}
            totalPosts={posts.length}
            onNavigate={openPostFromList}
          />

          <Footer />
        </>
      )}
    </div>
  );
}
