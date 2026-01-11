'use client';

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AttachmentCard, AuthorsLine, ChannelBadge, EndorsersLine, ImageThumb, RecordRenderer, TagList } from "./ui";
import { DictionaryModal } from "./DictionaryModal";
import { fetchDictionaryEntry, fetchPostData } from "@/lib/archive";
import { assetURL } from "@/lib/github";
import { type ArchiveListItem } from "@/lib/archive";
import { formatDate, timeAgo } from "@/lib/utils/dates";
import { type ArchiveEntryData, type IndexedDictionaryEntry, type StyleInfo } from "@/lib/types";

type Props = {
  post: ArchiveListItem;
  data?: ArchiveEntryData;
  schemaStyles?: Record<string, StyleInfo>;
  dictionaryTooltips?: Record<string, string>;
};

export function PostContent({ post, data, schemaStyles, dictionaryTooltips }: Props) {
  const [liveData, setLiveData] = useState<ArchiveEntryData | undefined>(data ?? post.data);
  const payload = liveData ?? post.data;
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [activeDictionary, setActiveDictionary] = useState<IndexedDictionaryEntry | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setLiveData(data ?? post.data));
    return () => cancelAnimationFrame(id);
  }, [data, post.data]);

  useEffect(() => {
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

  const handleInternalLink = useCallback((url: URL) => {
    if (url.origin !== (typeof window !== "undefined" ? window.location.origin : url.origin)) return false;
    const did = url.searchParams.get("did");
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((img) => (
            <div key={img.id} className="w-full">
              <ImageThumb
                img={img}
                onClick={() => {
                  setLightbox({ src: img.path || img.url, alt: img.description || img.name });
                }}
              />
              {img.description ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{img.description}</p> : null}
            </div>
          ))}
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

      {attachments.length ? (
        <section className="space-y-3">
          <h3 className="text-xl font-semibold tracking-wide text-gray-700 dark:text-gray-200">Attachments</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {attachments.map((att) => (
              <AttachmentCard key={att.id} att={att} onView={() => setLightbox({ src: att.path || att.url, alt: att.description || att.name })} />
            ))}
          </div>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            setLightbox(null);
          }}
        >
          <div className="relative h-full max-h-[90vh] w-full max-w-5xl">
            <Image src={lightbox.src} alt={lightbox.alt} fill className="object-contain" sizes="90vw" unoptimized />
          </div>
        </div>
      ) : null}

      {activeDictionary ? (
        <DictionaryModal entry={activeDictionary} onClose={() => setActiveDictionary(null)} dictionaryTooltips={dictionaryTooltips} />
      ) : null}
    </article>
  );
}
