'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useInView } from "@/hooks/useInView";
import { buildImagePath, ChannelBadge, TagList } from "./ui";
import { type ArchiveListItem } from "@/lib/archive";
import { getEntryArchivedAt, getEntryUpdatedAt, type SortKey } from "@/lib/types";
import { getAuthorName } from "@/lib/utils/authors";
import { formatDate, timeAgo } from "@/lib/utils/dates";
import { getPreviewByEntryId } from "@/lib/previews";

type Props = {
  post: ArchiveListItem;
  sortKey: SortKey;
  onNavigate: (post: ArchiveListItem) => void;
  ensurePostLoaded: (p: ArchiveListItem) => Promise<ArchiveListItem>;
};

export function PostCard({ post, sortKey, ensurePostLoaded, onNavigate }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "500px 0px" });

  useEffect(() => {
    if (inView) ensurePostLoaded(post).catch(() => {});
  }, [inView, ensurePostLoaded, post]);

  const preview = getPreviewByEntryId(post.entry.id);
  const hero = post.data?.images?.[0];
  const heroSrc = hero ? buildImagePath(post.channel.path, post.entry.path, hero) : null;
  const displaySrc =
    preview && (!heroSrc || heroSrc === preview.sourceUrl) ? preview.localPath : heroSrc;

  const updatedAt = getEntryUpdatedAt(post.entry);
  const archivedAt = getEntryArchivedAt(post.entry);
  const showArchivedTime = sortKey === "archived" || sortKey === "archivedOldest";
  const displayTs = showArchivedTime ? archivedAt ?? updatedAt : updatedAt ?? archivedAt;

  const authors = post.data?.authors?.filter((a) => !a.dontDisplay) || [];
  const authorsLine =
    authors.length > 0
      ? `${getAuthorName(authors[0])}${authors[1] ? ", " + getAuthorName(authors[1]) : ""}${authors.length > 2 ? ` +${authors.length - 2}` : ""}`
      : undefined;

  return (
    <article ref={ref} className="group flex h-full min-h-95 flex-col rounded-2xl bg-white transition hover:shadow-md dark:bg-gray-900">
      <Link
        href={`/archives/${post.slug}`}
        className="flex h-full w-full flex-col text-left"
        onClick={() => {
          onNavigate(post);
        }}
      >
        <div className="relative aspect-video min-h-45 w-full overflow-hidden rounded-t-2xl bg-black/7 dark:bg-white/5">
          {displaySrc ? (
            <Image
              src={displaySrc}
              alt={hero?.description || hero?.name || post.entry.name || "thumbnail"}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-contain"
              unoptimized
              priority={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">{post.data ? "No image" : "Loading..."}</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold">{post.entry.name}</h3>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">{post.entry.code}</span>
          </div>
          {authorsLine ? <div className="min-h-4 text-xs text-gray-600 dark:text-gray-300">{authorsLine}</div> : <div className="min-h-4" />}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-200">
            <ChannelBadge ch={post.channel} />
            <div className="flex flex-col items-end text-right">
              {displayTs !== undefined && <span title={displayTs ? formatDate(displayTs) : undefined}>{displayTs ? timeAgo(displayTs) : ""}</span>}
            </div>
          </div>
          <div className="min-h-13.5">
            <TagList tags={post.entry.tags || []} />
          </div>
        </div>
      </Link>
    </article>
  );
}
