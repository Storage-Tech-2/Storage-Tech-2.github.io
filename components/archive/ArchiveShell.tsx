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
import { getArchiveSlugInfo } from "@/lib/utils/urls";
import { normalize } from "@/lib/utils/strings";

type Props = {
  initialArchive: ArchiveIndex;
  pageNumber: number;
  pageSize: number;
  pageCount?: number;
};

type EmbeddingsEntryRaw = {
  identifier: string;
  embedding: string;
};

const ARCHIVE_EMBEDDINGS_URL = "https://raw.githubusercontent.com/Storage-Tech-2/Archive/main/embeddings.json";
const ARCHIVE_EMBEDDINGS_KEY = "archive-embeddings";

let hasHydratedArchiveShell = false;

export function ArchiveShell({
  initialArchive,
  pageNumber = 0,
  pageSize,
  pageCount,
}: Props) {

  const [hydrated, setHydrated] = useState(hasHydratedArchiveShell);
  const [isArchivePostURL, setIsArchivePostURL] = useState(false);
  const [aiSearchAvailable, setAiSearchAvailable] = useState(false);
  const [semanticSearch, setSemanticSearch] = useState<{ query: string; scoreById: Record<string, number> } | null>(null);
  const [semanticForceDisabled, setSemanticForceDisabled] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const latestSearchRequestIdRef = useRef<string | null>(null);
  const pendingQueryRef = useRef<string>("");
  
  useEffect(() => {
    hasHydratedArchiveShell = true;

    const canSetScroll = typeof window !== "undefined" && "scrollRestoration" in window.history;
    const previousScrollRestoration = canSetScroll ? window.history.scrollRestoration : null;
    if (canSetScroll) {
      window.history.scrollRestoration = "manual";
    }

    const url = new URL(window.location.href);
    const slug = getArchiveSlugInfo(url)?.slug;
    setIsArchivePostURL(!!slug);

    setHydrated(true);
    return () => {
      if (canSetScroll && previousScrollRestoration) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Worker" in window)) return;
    let cancelled = false;
    const worker = new Worker(new URL("../../workers/embeddingSearchWorker", import.meta.url));
    workerRef.current = worker;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; requestId?: string; scores?: Array<{ identifier: string; score: number }> };
      if (!data?.type) return;
      if (data.type === "setEmbeddingsComplete") {
        if (!cancelled) setAiSearchAvailable(true);
        return;
      }
      if (data.type === "getScoresComplete") {
        if (data.requestId !== latestSearchRequestIdRef.current) return;
        const scores = data.scores ?? [];
        const scoreById: Record<string, number> = {};
        scores.forEach((entry) => {
          scoreById[normalize(entry.identifier)] = entry.score;
        });
        if (!cancelled) {
          setSemanticSearch({ query: pendingQueryRef.current, scoreById });
        }
      }
      if (data.type === "getScoresError") {
        if (data.requestId === latestSearchRequestIdRef.current && !cancelled) {
          setSemanticSearch(null);
        }
      }
    };

    const handleError = () => {
      if (!cancelled) {
        setAiSearchAvailable(false);
        setSemanticSearch(null);
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const loadEmbeddings = async () => {
      try {
        const res = await fetch(ARCHIVE_EMBEDDINGS_URL);
        if (!res.ok) throw new Error(`Failed to load embeddings: ${res.status}`);
        const entries = (await res.json()) as EmbeddingsEntryRaw[];
        if (cancelled) return;
        worker.postMessage({
          type: "setEmbeddings",
          requestId: `set-${Date.now()}`,
          key: ARCHIVE_EMBEDDINGS_KEY,
          entries,
        });
      } catch {
        if (!cancelled) {
          setAiSearchAvailable(false);
          setSemanticSearch(null);
        }
      }
    };

    loadEmbeddings();

    return () => {
      cancelled = true;
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);



  const { posts, channels, error, config, refreshArchiveIndex } = useArchiveData({ initial: initialArchive });
  const archiveConfig = config ?? initialArchive.config;
  const globalTags = useMemo<GlobalTag[]>(
    () => archiveConfig.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS,
    [archiveConfig.globalTags],
  );
  const sidebarShellRef = useRef<HTMLElement | null>(null);
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
  } = useArchivePostShell({ posts, archiveRootHref, setIsArchivePostURL });

  const filters = useArchiveFilters({
    posts,
    channels,
    globalTags,
    pageNumber,
    pageSize,
    pageCount,
    isPostOpen,
    isArchivePostURL,
    hydrated,
    semanticSearch: {
      enabled: aiSearchAvailable,
      query: semanticSearch?.query ?? "",
      scoreById: semanticSearch?.scoreById ?? {},
      forceDisabled: semanticForceDisabled,
    },
  });

  useEffect(() => {
    if (!aiSearchAvailable) return;
    const trimmed = filters.search.q.trim();
    if (!trimmed) {
      setSemanticSearch(null);
      return;
    }
    const worker = workerRef.current;
    if (!worker) return;
    const timeout = setTimeout(() => {
      const requestId = `search-${Date.now()}`;
      latestSearchRequestIdRef.current = requestId;
      pendingQueryRef.current = trimmed;
      worker.postMessage({
        type: "getScores",
        requestId,
        key: ARCHIVE_EMBEDDINGS_KEY,
        query: trimmed,
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [filters.search.q, aiSearchAvailable]);

  const handleArchiveHomeClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    filters.reset();
    refreshArchiveIndex();
    const sidebar = sidebarShellRef.current;
    if (sidebar) sidebar.scrollTo({ top: 0 });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">

      {(!isPostOpen && !isArchivePostURL) ? (
        <HeaderBar
          siteName={siteConfig.siteName}
          view="archive"
          logoSrc={siteConfig.logoSrc}
          discordInviteUrl={siteConfig.discordInviteUrl}
          filters={filters}
          aiSearchAvailable={aiSearchAvailable}
          aiSearchApplied={filters.semantic.applied}
          onAiSearchToggle={() => {
            if (!aiSearchAvailable) return;
            setSemanticForceDisabled((prev) => !prev);
          }}
          onLogoClick={handleArchiveHomeClick}
          onArchiveClick={handleArchiveHomeClick}
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
        visible={!isPostOpen && !isArchivePostURL}
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
