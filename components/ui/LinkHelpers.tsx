'use client';

import Link from "next/link";
import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "@/lib/utils/classNames";
import { findPostBySlug, prefetchArchiveEntryData, prefetchArchiveIndex, prefetchDictionaryEntryData } from "@/lib/archive";
import { getDictionaryIdFromSlug, buildDictionarySlug } from "@/lib/dictionary";
import { transformOutputWithReferencesForWebsite } from "@/lib/utils/references";
import { postToMarkdown } from "@/lib/utils/markdown";
import { getArchiveSlugInfo } from "@/lib/utils/urls";
import type { IndexedDictionaryEntry, Reference, StyleInfo, SubmissionRecords } from "@/lib/types";
import { ForesightPrefetchLink } from "@/components/ui/ForesightPrefetchLink";

type LinkWithTooltipProps = React.ComponentProps<"a"> & {
  onInternalNavigate?: (url: URL) => boolean;
};

function linkTargetForHref(href?: string) {
  if (!href) return undefined;
  if (typeof window === "undefined") {
    if (/^https?:\/\//i.test(href)) return "_blank";
    if (/^mailto:/i.test(href)) return "_blank";
    return undefined;
  }
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin ? undefined : "_blank";
  } catch {
    return "_blank";
  }
}

export function LinkWithTooltip({ title, children, className, onInternalNavigate, href, ...rest }: LinkWithTooltipProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (typeof window === "undefined") return;
    if (!href || rest.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (onInternalNavigate && onInternalNavigate(url)) {
        e.preventDefault();
      }
    } catch {
      // ignore malformed url
    }
  };

  const prefetchDictionaryForHref = () => {
    if (typeof window === "undefined" || !href) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      let did = url.searchParams.get("did");
      if (!did && url.pathname.startsWith("/dictionary/")) {
        const slug = url.pathname.replace("/dictionary/", "").replace(/\/+$/, "");
        did = getDictionaryIdFromSlug(decodeURIComponent(slug));
      }
      if (did) prefetchDictionaryEntryData(did);
    } catch {
      // ignore
    }
  };

  const prefetchArchiveForHref = () => {
    if (typeof window === "undefined" || !href) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const { slug, isArchiveRoot } = getArchiveSlugInfo(url);
      if (isArchiveRoot) {
        prefetchArchiveIndex();
        return;
      }
      if (!slug) return;
      prefetchArchiveIndex().then((idx) => {
        if (!idx) return;
        const match = findPostBySlug(idx.posts, slug);
        if (match) prefetchArchiveEntryData(match);
      });
    } catch {
      // ignore
    }
  };

  const onPrefetch = () => {
    prefetchDictionaryForHref();
    prefetchArchiveForHref();
  };

  const tooltip = title ? (
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-64 -translate-x-1/2 rounded-md bg-black px-3 py-2 text-sm text-white shadow-lg group-hover:block">
      {title}
    </span>
  ) : null;

  const linkClassName = clsx("underline", className);

  return (
    <span className="group relative inline-block">
      {href ? (
        <ForesightPrefetchLink href={href} onClick={handleClick} beforePrefetch={onPrefetch} className={linkClassName} {...rest}>
          {children}
        </ForesightPrefetchLink>
      ) : (
        <a {...rest} href={href} onClick={handleClick} className={linkClassName}>
          {children}
        </a>
      )}
      {tooltip}
    </span>
  );
}

export function MarkdownText({ text, onInternalLink }: { text: string; onInternalLink?(url: URL): boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 {...props} className="text-2xl font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h2: (props) => <h2 {...props} className="text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h3: (props) => <h3 {...props} className="text-lg font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h4: (props) => <h4 {...props} className="text-base font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        a: (props) => {
          const target = linkTargetForHref(props.href);
          return (
            <LinkWithTooltip
              {...props}
              onInternalNavigate={onInternalLink}
              target={target}
              rel={target === "_blank" ? "noreferrer" : props.rel}
            />
          );
        },
        p: (props) => <p {...props} className="whitespace-pre-wrap leading-relaxed" />,
        ul: (props) => <ul {...props} className="ml-5 list-disc" />,
        ol: (props) => <ol {...props} className="ml-5 list-decimal" />,
        code: (props) => <code {...props} className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function RecordRenderer({
  records,
  recordStyles,
  schemaStyles,
  references,
  dictionaryTooltips,
  onInternalLink,
}: {
  records: SubmissionRecords;
  recordStyles?: Record<string, StyleInfo>;
  schemaStyles?: Record<string, StyleInfo>;
  references?: Reference[];
  dictionaryTooltips?: Record<string, string>;
  onInternalLink?(url: URL): boolean;
}) {
  const markdown = useMemo(() => postToMarkdown(records, recordStyles, schemaStyles), [records, recordStyles, schemaStyles]);
  const decorated = useMemo(
    () => transformOutputWithReferencesForWebsite(markdown, references || [], (id) => dictionaryTooltips?.[id]),
    [markdown, references, dictionaryTooltips],
  );

  if (!decorated) return null;
  return <MarkdownText text={decorated} onInternalLink={onInternalLink} />;
}

export function DictionaryCard({ entry, onOpen }: { entry: IndexedDictionaryEntry; onOpen?(entry: IndexedDictionaryEntry): void }) {
  const primary = entry.index.terms[0] || entry.index.id;
  const extraCount = Math.max(0, (entry.index.terms?.length || 0) - 1);
  const slug = buildDictionarySlug(entry.index);
  const href = `/dictionary/${encodeURIComponent(slug)}`;
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onOpen?.(entry);
      }}
      onMouseEnter={() => prefetchDictionaryEntryData(entry.index.id)}
      onFocus={() => prefetchDictionaryEntryData(entry.index.id)}
      onPointerEnter={() => prefetchArchiveIndex()}
      className="group flex h-full w-full flex-col items-start rounded-2xl border bg-white text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="p-4 text-left">
        <div className="space-y-1">
          <div className="text-sm font-semibold leading-tight">{primary}</div>
          {extraCount > 0 && <div className="text-[11px] text-gray-500 dark:text-gray-400">{`+${extraCount} more ${extraCount === 1 ? "alias" : "aliases"}`}</div>}
          {entry.index.summary && <div className="text-xs text-gray-600 line-clamp-3 dark:text-gray-300">{entry.index.summary}</div>}
        </div>
      </div>
    </Link>
  );
}