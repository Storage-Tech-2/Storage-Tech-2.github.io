'use client';

import Image from "next/image";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findPostBySlug, prefetchArchiveEntryData, prefetchArchiveIndex, prefetchDictionaryEntryData } from "@/lib/archive";
import { assetURL } from "@/lib/github";
import { clsx } from "@/lib/utils/classNames";
import { getAuthorIconURL, getAuthorName } from "@/lib/utils/authors";
import { getYouTubeEmbedURL } from "@/lib/utils/media";
import { postToMarkdown } from "@/lib/utils/markdown";
import { getSpecialTagMeta, sortTagsForDisplay } from "@/lib/utils/tagDisplay";
import { transformOutputWithReferencesForWebsite } from "@/lib/utils/references";
import { buildDictionarySlug, getDictionaryIdFromSlug } from "@/lib/dictionary";
import {
  type Attachment,
  type Author,
  type Image as ArchiveImage,
  type IndexedDictionaryEntry,
  type Reference,
  type StyleInfo,
  type SubmissionRecords,
  type GlobalTag,
  type Tag,
} from "@/lib/types";
import { ForesightPrefetchLink } from "../ForesightPrefetchLink";

export function ChannelBadge({ ch }: { ch: { code: string; name: string; description?: string } }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700 dark:text-white" title={ch.description}>
      <span className="font-semibold">{ch.code}</span>
      <span className="text-gray-500 dark:text-white">{ch.name}</span>
    </span>
  );
}

function buildTagStyle(color?: string): React.CSSProperties | undefined {
  if (!color) return undefined;
  return {
    "--tag-color": color,
    "--tag-bg-light": `color-mix(in lab, ${color} 12%, white)`,
    "--tag-bg-dark": `color-mix(in lab, ${color} 18%, black)`,
    "--tag-text-light": `color-mix(in srgb, ${color} 40%, black)`,
    "--tag-text-dark": `color-mix(in srgb, ${color} 65%, white)`,
  } as React.CSSProperties;
}

export function TagChip({ tag, state, count, onToggle, globalTags }: { tag: Tag; state: -1 | 0 | 1; count?: number; onToggle?: (rightClick: boolean) => void; globalTags?: GlobalTag[] }) {
  const meta = getSpecialTagMeta(tag.name, globalTags);
  const metaStyle = meta?.color ? buildTagStyle(meta.color) : undefined;
  const base = "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors";
  const cls =
    state === 1
      ? (meta ? "text-[color:var(--tag-text-light)] bg-[var(--tag-color)]" : "bg-blue-600 text-white border-blue-600 shadow-sm")
      : state === -1
        ? "bg-red-600 text-white border-red-600 shadow-sm"
        : meta
          ? "text-[color:var(--tag-text-light)] dark:text-[color:var(--tag-text-dark)] bg-[var(--tag-bg-light)] dark:bg-[var(--tag-bg-dark)]"
          : "text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900";
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        if (onToggle) onToggle(e.type === "contextmenu");
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onToggle) onToggle(true);
      }}
      className={clsx(base, cls)}
      style={metaStyle}
      title={state === -1 ? "Excluded" : state === 1 ? "Included" : "Not selected"}
    >
      {meta?.icon && <span className="text-[12px]">{meta.icon}</span>}
      <span>{tag.name}</span>
      {typeof count === "number" && <span className="rounded bg-black/10 px-1 text-[10px] dark:bg-white/10">{count}</span>}
    </button>
  );
}

export function TagPill({ name, globalTags }: { name: string; globalTags?: GlobalTag[] }) {
  const meta = getSpecialTagMeta(name, globalTags);
  const metaStyle = meta?.color ? buildTagStyle(meta.color) : undefined;
  const base = "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold leading-none whitespace-nowrap";
  const cls = meta
    ? "text-[color:var(--tag-text-light)] dark:text-[color:var(--tag-text-dark)] bg-[var(--tag-bg-light)] dark:bg-[var(--tag-bg-dark)]"
    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  return (
    <span className={clsx(base, cls)} style={metaStyle}>
      {meta?.icon && <span className="text-[12px]">{meta.icon}</span>}
      <span>{name}</span>
    </span>
  );
}

export function AuthorsLine({ authors }: { authors: Author[] }) {
  const visible = authors?.filter((a) => !a.dontDisplay) || [];
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <span className="font-medium">Authors:</span>
      {visible.slice(0, 3).map((a, i) => (
        <AuthorInline key={`au-${i}`} a={a} />
      ))}
      {visible.length > 3 && <span>+{visible.length - 3}</span>}
    </div>
  );
}

export function EndorsersLine({ endorsers }: { endorsers: Author[] }) {
  const vis = endorsers || [];
  if (!vis.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <span className="font-medium">Endorsed by:</span>
      {vis.slice(0, 4).map((a, i) => (
        <AuthorInline key={`en-${i}`} a={a} />
      ))}
      {vis.length > 4 && <span>+{vis.length - 4}</span>}
    </div>
  );
}

export function AuthorInline({ a }: { a: Author }) {
  const name = getAuthorName(a);
  const iconURL = getAuthorIconURL(a);

  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100">
      {iconURL ? (
        <Image src={iconURL} alt="" className="h-4 w-4 rounded-full" width={16} height={16} unoptimized />
      ) : (
        <span className="inline-block h-4 w-4 rounded-full bg-gray-300" />
      )}
      {a.url ? (
        <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
          {name}
        </a>
      ) : (
        name
      )}
    </span>
  );
}

type PdfPreviewRequest = { src: string; title?: string; description?: string };

export function AttachmentCard({
  att,
  onView,
  onViewPdf,
}: {
  att: Attachment;
  onView?: (img: ArchiveImage) => void;
  onViewPdf?: (pdf: PdfPreviewRequest) => void;
}) {
  const href = att.path && att.canDownload ? att.path : att.url;
  const sourceURL = att.path || att.url;
  const schematicURL = att.litematic && sourceURL ? `https://storagetech2.org/renderer?url=${sourceURL}` : null;
  const videoFilePattern = /\.(mp4|webm|m3u8|mpd)$/i;
  const isVideo = !att.youtube && (att.contentType?.startsWith("video/") || videoFilePattern.test(att.name));
  const kind = att.youtube
    ? "YouTube"
    : att.litematic
      ? "Litematic"
      : att.wdl
        ? "WDL"
        : isVideo
          ? "Video"
          : att.contentType?.toUpperCase() || "FILE";
  const ext = (att.name?.split(".")?.pop() || "").toUpperCase();
  const title = att.youtube?.title || att.name;
  const embedSrc = att.youtube ? getYouTubeEmbedURL(att.url) : null;
  const videoEmbedSrc = isVideo && sourceURL ? `https://faststream.online/player/#${sourceURL}` : null;
  const isImage = !isVideo && (att.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.name || ""));
  const isPdf = !att.youtube && (att.contentType?.toLowerCase().includes("pdf") || /\.pdf$/i.test(att.name || ""));
  const pdfSource = isPdf ? sourceURL : null;
  const imageForView: ArchiveImage = att;
  const [showSchematic, setShowSchematic] = useState(false);
  return (
    <>
      <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-white dark:border-gray-800 dark:bg-gray-900">
        {att.youtube ? (
          <div className="bg-black">
            {embedSrc ? (
              <iframe
                src={embedSrc}
                title={title}
                className="aspect-video w-full"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <a href={att.url} target="_blank" rel="noreferrer" className="block bg-black/5">
                <Image src={att.youtube!.thumbnail_url} alt={title} className="aspect-video w-full object-contain" width={att.youtube!.thumbnail_width} height={att.youtube!.thumbnail_height} unoptimized />
              </a>
            )}
          </div>
        ) : null}
        {videoEmbedSrc ? (
          <div className="bg-black">
            <iframe src={videoEmbedSrc} title={title} className="aspect-video w-full" frameBorder={0} allowFullScreen />
          </div>
        ) : null}
        {isImage && onView && att.canDownload ? <ImageThumb img={imageForView} onClick={() => onView(imageForView)} /> : null}

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {kind}
              {ext && !att.youtube ? ` · ${ext}` : ""}
            </span>
          </div>
          <h5 className="text-sm font-semibold leading-snug wrap-break-word">{title}</h5>
          {!att.youtube && <div className="text-[11px] text-gray-500 wrap-break-word">{att.name}</div>}
          {att.description && <div className="text-xs text-gray-700 dark:text-gray-300 wrap-break-word">{att.description}</div>}

          {att.litematic ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {att.litematic.version && (
                <li>
                  <span className="font-medium">Version:</span> {att.litematic.version}
                </li>
              )}
              {att.litematic.size && (
                <li>
                  <span className="font-medium">Size:</span> {att.litematic.size}
                </li>
              )}
              {att.litematic.error && <li className="text-red-600">{att.litematic.error}</li>}
            </ul>
          ) : null}
          {att.wdl ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {att.wdl.version && (
                <li>
                  <span className="font-medium">Minecraft:</span> {att.wdl.version}
                </li>
              )}
              {att.wdl.error && <li className="text-red-600">{att.wdl.error}</li>}
            </ul>
          ) : null}
          {att.youtube ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              <li>
                <span className="font-medium">By:</span>{" "}
                {att.youtube.author_url ? (
                  <a className="underline" href={att.youtube.author_url} target="_blank" rel="noreferrer">
                    {att.youtube.author_name}
                  </a>
                ) : (
                  att.youtube.author_name
                )}
              </li>
              {att.youtube.width && att.youtube.height ? (
                <li>
                  <span className="font-medium">Resolution:</span> {att.youtube.width}×{att.youtube.height}
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            {att.litematic ? (
              <button
                type="button"
                onClick={() => schematicURL && setShowSchematic(true)}
                disabled={!schematicURL}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800"
              >
                View Schematic
              </button>
            ) : null}
            {isPdf && pdfSource && onViewPdf ? (
              <button
                type="button"
                onClick={() => onViewPdf({ src: pdfSource, title, description: att.description })}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                View PDF
              </button>
            ) : null}
            {att.canDownload ? (
              <a href={href} download className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Download
              </a>
            ) : (
              <a href={href} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Open
              </a>
            )}
          </div>
        </div>
      </article>
      {showSchematic && schematicURL ? (
        <div className="fixed inset-0 z-50 bg-black/80" onClick={() => setShowSchematic(false)}>
          <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
            <iframe src={schematicURL} title={title ? `${title} schematic` : "Schematic viewer"} className="h-full w-full border-0 bg-white" allowFullScreen />
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border bg-white/80 px-3 py-1 text-sm font-semibold shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
              onClick={() => setShowSchematic(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ImageThumb({ img, onClick }: { img: ArchiveImage; onClick?: () => void }) {
  const src = img.path ? img.path : img.url;
  return (
    <button className="block overflow-hidden rounded-lg border bg-black/5 dark:bg-white/5" onClick={onClick} title={img.description}>
      <Image src={src} alt={img.description || img.name} width={640} height={360} className="h-40 w-full object-contain" unoptimized />
    </button>
  );
}

type LinkWithTooltipProps = React.ComponentProps<"a"> & {
  onInternalNavigate?: (url: URL) => boolean;
  onPrefetch?: () => void;
};

function isArchivePostHref(href?: string) {
  return typeof href === "string" && /^\/archives\//.test(href);
}

export function LinkWithTooltip(props: LinkWithTooltipProps) {
  const { title, children, className, onInternalNavigate, href, ...rest } = props;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (typeof window === "undefined") return;
    if (!href || rest.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (onInternalNavigate && onInternalNavigate(url)) {
        e.preventDefault();
        return;
      }
    } catch {
      // fall back to default navigation
    }
  };

  const prefetchDictionaryForHref = () => {
    if (typeof window === "undefined") return;
    if (!href) return;
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
      // ignore malformed hrefs
    }
  };

  const prefetchArchiveForHref = () => {
    if (typeof window === "undefined") return;
    if (!href) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/archives/")) return;
      const slug = url.pathname.replace("/archives/", "").replace(/\/+$/, "");
      if (!slug) {
        prefetchArchiveIndex();
        return;
      }
      prefetchArchiveIndex().then((idx) => {
        if (!idx) return;
        let decodedSlug = slug;
        try {
          decodedSlug = decodeURIComponent(slug);
        } catch {
          // ignore decode issues and fall back to raw slug
        }
        const match = findPostBySlug(idx.posts, decodedSlug);
        if (match) prefetchArchiveEntryData(match);
      });
    } catch {
      // ignore malformed hrefs
    }
  };

  const onPrefetch = () => {
    prefetchDictionaryForHref();
    prefetchArchiveForHref();
    if (href && isArchivePostHref(href)) {
      return true; // prefetch
    } else {
      return false; // do not prefetch
    }
  }

  const tooltip = title ? (
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-64 -translate-x-1/2 rounded-md bg-black px-3 py-2 text-sm text-white shadow-lg group-hover:block">
      {title}
    </span>
  ) : null;

  const linkClassName = clsx("underline", className);

  return (
    <span className="group relative inline-block">
      {href ? (
        <ForesightPrefetchLink
          href={href}
          onClick={handleClick}
          onPrefetch={onPrefetch}
          className={linkClassName}
          {...rest}
        >
          {children}
        </ForesightPrefetchLink>
      ) : (
        <a
          {...rest}
          href={href}
          onClick={handleClick}
          className={linkClassName}
        >
          {children}
        </a>
      )}
      {tooltip}
    </span>
  );
}

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

export function MarkdownText({ text, onInternalLink }: { text: string; onInternalLink?: (url: URL) => boolean }) {
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
  onInternalLink?: (url: URL) => boolean;
}) {
  const markdown = useMemo(() => postToMarkdown(records, recordStyles, schemaStyles), [records, recordStyles, schemaStyles]);
  const decorated = useMemo(
    () => transformOutputWithReferencesForWebsite(markdown, references || [], (id) => dictionaryTooltips?.[id]),
    [markdown, references, dictionaryTooltips],
  );

  if (!decorated) return null;
  return <MarkdownText text={decorated} onInternalLink={onInternalLink} />;
}

export function DictionaryCard({ entry, onOpen }: { entry: IndexedDictionaryEntry; onOpen: (entry: IndexedDictionaryEntry) => void }) {
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
        onOpen(entry);
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

export function TagList({ tags, globalTags }: { tags: string[]; globalTags?: GlobalTag[] }) {
  if (!tags?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {sortTagsForDisplay(tags, globalTags).map((name) => (
        <TagPill key={name} name={name} globalTags={globalTags} />
      ))}
    </div>
  );
}

export function buildImagePath(channelPath: string, entryPath: string, img?: ArchiveImage) {
  if (!img) return undefined;
  if (img.path) return assetURL(channelPath, entryPath, img.path);
  return img.url;
}
