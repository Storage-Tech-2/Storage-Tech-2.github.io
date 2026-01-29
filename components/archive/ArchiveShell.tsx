'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { HeaderBar } from "./HeaderBar";
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
  const { posts, channels, error, config } = useArchiveData({ initial: initialArchive });
  const archiveConfig = config ?? initialArchive.config;
  const globalTags = useMemo<GlobalTag[]>(
    () => archiveConfig.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS,
    [archiveConfig.globalTags],
  );
  const sidebarShellRef = useRef<HTMLElement | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const archiveRootHref = `${siteConfig.basePath || ""}/archives`;

  const [clientReady, setClientReady] = useState(hasHydratedArchiveShell);
  useEffect(() => {
    hasHydratedArchiveShell = true;
    if (clientReady) return;
    const id = requestAnimationFrame(() => setClientReady(true));
    return () => cancelAnimationFrame(id);
  }, [clientReady]);

  const {
    openPost,
    openData,
    openDictionaryTooltips,
    openLoading,
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
    clientReady,
    isPostOpen,
    sidebarRef: sidebarShellRef,
  });

  useArchiveScrollRestore({
    pendingScrollRef,
    clientReady,
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
          loading={openLoading}
          error={openError}
          globalTags={globalTags}
          archiveConfig={archiveConfig}
          onClose={closePost}
          onArchiveNavigate={handleArchiveUrlNavigate}
        />
      ) : (
        <div>
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
            clientReady={clientReady}
            totalPosts={posts.length}
            onNavigate={openPostFromList}
          />
        </div>
      )}
      <Footer />
    </div>
  );
}
