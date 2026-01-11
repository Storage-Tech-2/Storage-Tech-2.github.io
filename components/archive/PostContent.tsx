'use client';

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttachmentCard, AuthorInline, AuthorsLine, ChannelBadge, EndorsersLine, ImageThumb, MarkdownText, RecordRenderer, TagList } from "./ui";
import { DictionaryModal } from "./DictionaryModal";
import { fetchCommentsData, fetchDictionaryEntry, fetchPostData } from "@/lib/archive";
import { getDictionaryIdFromSlug } from "@/lib/dictionary";
import { assetURL } from "@/lib/github";
import { type ArchiveListItem } from "@/lib/archive";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { formatDate, timeAgo } from "@/lib/utils/dates";
import { type ArchiveEntryData, type ArchiveComment, type Author, type IndexedDictionaryEntry, type Reference, type StyleInfo } from "@/lib/types";
import { getAuthorName } from "@/lib/utils/authors";
import { transformOutputWithReferencesForWebsite } from "@/lib/utils/references";
import { replaceAttachmentsInText } from "@/lib/utils/attachments";

type Props = {
  post: ArchiveListItem;
  data?: ArchiveEntryData;
  schemaStyles?: Record<string, StyleInfo>;
  dictionaryTooltips?: Record<string, string>;
};

export function PostContent({ post, data, schemaStyles, dictionaryTooltips }: Props) {
  const [liveData, setLiveData] = useState<ArchiveEntryData | undefined>(data ?? post.data);
  const payload = liveData ?? post.data;
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; index?: number; mode: "gallery" | "single" } | null>(null);
  const [activeDictionary, setActiveDictionary] = useState<IndexedDictionaryEntry | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const [comments, setComments] = useState<ArchiveComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setLiveData(data ?? post.data));
    return () => cancelAnimationFrame(id);
  }, [data, post.data]);

  useEffect(() => {
    if (disableLiveFetch) return;
    let cancelled = false;
    fetchPostData(post.channel.path, post.entry, undefined, undefined, undefined, "no-store")
      .then((fresh) => {
        if (!cancelled) setLiveData(fresh);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [post.channel.path, post.entry]);

  useEffect(() => {
    if (disableLiveFetch) {
      setComments(null);
      setCommentsLoading(false);
      return;
    }
    let cancelled = false;
    setComments(null);
    setCommentsLoading(true);
    fetchCommentsData(post.channel.path, post.entry, undefined, undefined, undefined, "no-store")
      .then((items) => {
        if (!cancelled) setComments(items);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.channel.path, post.entry]);

  const handleInternalLink = useCallback((url: URL) => {
    if (disableLiveFetch) return false;
    if (url.origin !== (typeof window !== "undefined" ? window.location.origin : url.origin)) return false;
    let did = url.searchParams.get("did");
    if (!did && url.pathname.startsWith("/dictionary/")) {
      const slug = url.pathname.replace("/dictionary/", "").replace(/\/+$/, "");
      did = getDictionaryIdFromSlug(decodeURIComponent(slug));
    }
    if (!did) return false;
    fetchDictionaryEntry(did)
      .then((entryData) => {
        setActiveDictionary({
          index: {
            id: entryData.id,
            terms: entryData.terms,
            summary: entryData.definition?.slice(0, 140) || "",
            updatedAt: entryData.updatedAt,
          },
          data: entryData,
        });
      })
      .catch(() => {
        setActiveDictionary({
          index: { id: did, terms: [did], summary: "", updatedAt: Date.now() },
          data: undefined as never,
        });
      });
    return true;
  }, []);

  const images = payload?.images?.map((img) => ({
    ...img,
    path: img.path ? assetURL(post.channel.path, post.entry.path, img.path) : img.url,
  })) ?? [];
  const activeImage = images[activeImageIndex] || null;

  const imageAspect = "16/9";

  const attachments = payload?.attachments?.map((att) => ({
    ...att,
    path: att.path ? assetURL(post.channel.path, post.entry.path, att.path) : att.path,
  })) ?? [];

  const updatedAt = payload?.updatedAt ?? post.entry.updatedAt;
  const archivedAt = payload?.archivedAt ?? post.entry.archivedAt;

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Archive Entry</p>
            <h1 className="text-3xl font-bold leading-tight text-gray-900 dark:text-white">{post.entry.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <ChannelBadge ch={post.channel} />
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-gray-800">{post.entry.code}</span>
              {updatedAt !== undefined ? (
                <span className="text-gray-700 dark:text-gray-200" title={formatDate(updatedAt)}>
                  Updated {timeAgo(updatedAt)}
                </span>
              ) : null}
              {archivedAt !== undefined ? (
                <span className="text-gray-700 dark:text-gray-200" title={formatDate(archivedAt)}>
                  Archived {timeAgo(archivedAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <TagList tags={post.entry.tags || []} />
        {payload ? (
          <div className="flex flex-col gap-2">
            <AuthorsLine authors={payload.authors || []} />
            <EndorsersLine endorsers={payload.endorsers || []} />
          </div>
        ) : null}
      </header>

      {images.length ? (
        <div className="flex flex-col gap-3">
          <div
            className="relative w-full overflow-hidden rounded-xl bg-black/5 dark:bg-white/5"
            style={{ aspectRatio: imageAspect, maxHeight: "70vh" }}
            onPointerDown={(e) => {
              dragStartRef.current = e.clientX;
              didDragRef.current = false;
            }}
            onPointerUp={(e) => {
              if (dragStartRef.current === null) return;
              const delta = e.clientX - dragStartRef.current;
              dragStartRef.current = null;
              if (Math.abs(delta) < 40) return;
              didDragRef.current = true;
              setActiveImageIndex((idx) => {
                if (delta < 0) return Math.min(images.length - 1, idx + 1);
                return Math.max(0, idx - 1);
              });
            }}
            onClick={() => {
              if (!activeImage || didDragRef.current) return;
              setLightbox({
                src: activeImage.path || activeImage.url,
                alt: activeImage.description || activeImage.name,
                index: activeImageIndex,
                mode: "gallery",
              });
            }}
          >
            {activeImage ? (
              <Image
                src={activeImage.path || activeImage.url}
                alt={activeImage.description || activeImage.name}
                fill
                className="object-contain"
                sizes="100vw"
                unoptimized
              />
            ) : null}
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
                  onClick={() => setActiveImageIndex((idx) => Math.max(0, idx - 1))}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
                  onClick={() => setActiveImageIndex((idx) => Math.min(images.length - 1, idx + 1))}
                >
                  →
                </button>
                <div className="absolute bottom-2 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                  {activeImageIndex + 1} / {images.length}
                </div>
              </>
            ) : null}
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full border bg-white/80 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
              onClick={() => {
                if (!activeImage) return;
                setLightbox({
                  src: activeImage.path || activeImage.url,
                  alt: activeImage.description || activeImage.name,
                  index: activeImageIndex,
                  mode: "gallery",
                });
              }}
            >
              View
            </button>
          </div>
          {activeImage?.description ? <p className="text-sm text-gray-600 dark:text-gray-300">{activeImage.description}</p> : null}
          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, index) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg border ${index === activeImageIndex ? "border-blue-500" : "border-transparent"}`}
                  title={img.description || img.name}
                >
                  <Image src={img.path || img.url} alt={img.description || img.name} fill className="object-contain" sizes="112px" unoptimized />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {payload?.records ? (
        <RecordRenderer
          records={payload.records}
          recordStyles={payload.styles}
          schemaStyles={schemaStyles}
          references={payload.references}
          dictionaryTooltips={dictionaryTooltips}
          onInternalLink={handleInternalLink}
        />
      ) : (
        <div className="text-sm text-gray-500">Loading post body...</div>
      )}

      {payload ? (
        (() => {
          const acknowledgements = (payload as { acknowledgements?: Array<Partial<Author> & { reason?: string }> }).acknowledgements || [];
          const authorReferences = (payload as { author_references?: Reference[] }).author_references;
          if (!acknowledgements.length) return null;
          return (
            <div>
              <h4 className="mb-2 text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300">Acknowledgements</h4>
              <ul className="space-y-3">
                {acknowledgements.map((a, i) => {
                  const decorated = transformOutputWithReferencesForWebsite(
                    a.reason || "",
                    authorReferences || [],
                    (id) => dictionaryTooltips?.[id],
                  );
                  const name = getAuthorName(a as Author);
                  const handle = a.username && a.username !== name ? a.username : null;
                  const initial = name.trim().charAt(0).toUpperCase() || "?";
                  const iconURL = (a as { iconURL?: string }).iconURL;
                  const url = (a as { url?: string }).url;
                  return (
                    <li key={i} className="flex gap-3 rounded-xl border p-3 dark:border-gray-800">
                      <div className="flex-shrink-0">
                        {iconURL ? (
                          <Image src={iconURL} alt={name} className="h-10 w-10 rounded-full object-cover" width={40} height={40} unoptimized />
                        ) : (
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            {initial}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                                {name}
                              </a>
                            ) : (
                              name
                            )}
                          </span>
                          {handle ? <span className="text-xs text-gray-500">@{handle}</span> : null}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <MarkdownText text={decorated} onInternalLink={handleInternalLink} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()
      ) : null}

      {attachments.length ? (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold tracking-wide text-gray-700 dark:text-gray-200">Attachments</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {attachments.map((att) => (
              <AttachmentCard
                key={att.id}
                att={att}
                onView={() =>
                  setLightbox({
                    src: att.path || att.url,
                    alt: att.description || att.name,
                    mode: "single",
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {commentsLoading ? (
        <div className="text-sm text-gray-500">Loading comments...</div>
      ) : comments?.length ? (
        <section className="space-y-3">
          <CommentsList comments={comments} channelPath={post.channel.path} entryPath={post.entry.path} onInternalLink={handleInternalLink} setLightbox={setLightbox} />
        </section>
      ) : null}

      {payload?.post?.threadURL ? (
        <a
          href={payload.post.threadURL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          View Discord Thread
        </a>
      ) : null}

      {lightbox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: imageAspect, maxHeight: "80vh" }}>
              <Image src={lightbox.src} alt={lightbox.alt} fill className="object-contain" sizes="90vw" unoptimized />
              {lightbox.mode === "gallery" && images.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
                    onClick={() =>
                      setActiveImageIndex((idx) => {
                        const next = Math.max(0, idx - 1);
                        setLightbox({
                          src: images[next].path || images[next].url,
                          alt: images[next].description || images[next].name,
                          index: next,
                          mode: "gallery",
                        });
                        return next;
                      })
                    }
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/80 px-3 py-1 text-sm shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
                    onClick={() =>
                      setActiveImageIndex((idx) => {
                        const next = Math.min(images.length - 1, idx + 1);
                        setLightbox({
                          src: images[next].path || images[next].url,
                          alt: images[next].description || images[next].name,
                          index: next,
                          mode: "gallery",
                        });
                        return next;
                      })
                    }
                  >
                    →
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="absolute right-3 top-3 rounded-full border bg-white/80 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-gray-700 dark:bg-gray-900/80"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox(null);
                }}
              >
                Close
              </button>
            </div>
            {lightbox.mode === "gallery" ? (
              activeImage?.description ? <p className="mt-2 text-sm text-white/80">{activeImage.description}</p> : null
            ) : lightbox.alt ? (
              <p className="mt-2 text-sm text-white/80">{lightbox.alt}</p>
            ) : null}
            {lightbox.mode === "gallery" && images.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((img, index) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setActiveImageIndex(index);
                      setLightbox({ src: img.path || img.url, alt: img.description || img.name, index, mode: "gallery" });
                    }}
                    className={`relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg border ${index === activeImageIndex ? "border-blue-500" : "border-transparent"}`}
                    title={img.description || img.name}
                  >
                    <Image src={img.path || img.url} alt={img.description || img.name} fill className="object-contain" sizes="112px" unoptimized />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeDictionary ? (
        <DictionaryModal entry={activeDictionary} onClose={() => setActiveDictionary(null)} dictionaryTooltips={dictionaryTooltips} />
      ) : null}
    </article>
  );
}

function CommentsList({
  comments,
  channelPath,
  entryPath,
  onInternalLink,
  setLightbox,
}: {
  comments: ArchiveComment[];
  channelPath: string;
  entryPath: string;
  onInternalLink: (url: URL) => boolean;
  setLightbox: (img: { src: string; alt: string; index?: number; mode: "gallery" | "single" }) => void;
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold tracking-wide text-gray-700 dark:text-gray-200">Comments</h3>
      <ol className="space-y-3">
        {comments.map((c) => {
          const attachments = (c.attachments || []).map((att) => ({
            ...att,
            path: att.path ? assetURL(channelPath, entryPath, att.path) : att.path,
          }));
          return (
            <li key={c.id} className="rounded-xl border p-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-2">
                <AuthorInline a={c.sender} />
                <span className="text-xs text-gray-500" title={formatDate(c.timestamp)}>
                  {timeAgo(c.timestamp)}
                </span>
              </div>
              {c.content ? (
                <div className="mt-2 text-sm">
                  <MarkdownText text={replaceAttachmentsInText(c.content, attachments)} onInternalLink={onInternalLink} />
                </div>
              ) : null}
              {attachments.length ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {attachments.map((att) => (
                    <AttachmentCard
                      key={att.id}
                      att={att}
                      onView={() =>
                        setLightbox({
                          src: att.path || att.url,
                          alt: att.description || att.name,
                          mode: "single",
                        })
                      }
                    />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
