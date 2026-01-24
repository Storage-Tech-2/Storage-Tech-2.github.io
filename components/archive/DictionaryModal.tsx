'use client';

import { useEffect, useState } from "react";
import { ChannelBadge, MarkdownText } from "./ui";
import { RelativeTime } from "./RelativeTime";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { fetchArchiveIndex, type ArchiveListItem } from "@/lib/archive";
import { getEntryArchivedAt, getEntryUpdatedAt, type IndexedDictionaryEntry } from "@/lib/types";
import { transformOutputWithReferencesForWebsite } from "@/lib/utils/references";
import Link from "next/link";

type Props = {
  entry: IndexedDictionaryEntry;
  onClose: () => void;
  dictionaryTooltips?: Record<string, string>;
  onInternalLink?: (url: URL) => boolean;
  variant?: "modal" | "inline";
};

export function DictionaryModal({ entry, onClose, dictionaryTooltips, onInternalLink, variant = "modal" }: Props) {
  const decorated = entry.data
    ? transformOutputWithReferencesForWebsite(entry.data.definition, entry.data.references || [], (id) => dictionaryTooltips?.[id])
    : "";
  const [referencedBy, setReferencedBy] = useState<Array<{ code: string; post?: ArchiveListItem }>>([]);
  const isInline = variant === "inline";

  useEffect(() => {
    if (disableLiveFetch) return;
    const referencedCodes = (entry.data as { referencedBy?: string[] } | undefined)?.referencedBy;
    if (!referencedCodes?.length) return;
    let cancelled = false;
    fetchArchiveIndex()
      .then((archive) => {
        if (cancelled) return;
        const byCode = new Map(archive.posts.map((post) => [post.entry.codes[0], post]));
        setReferencedBy(referencedCodes.map((code) => ({ code, post: byCode.get(code) })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const content = (
    <article
      className="w-full max-w-3xl rounded-2xl border bg-white p-0 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="space-y-2">
          <h3 className="text-lg font-bold">{entry.index.terms[0] || entry.index.id}</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <RelativeTime ts={entry.index.updatedAt} prefix="Updated" />
          </div>
          {entry.index.terms.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {entry.index.terms.slice(1).map((term, i) => (
                <span
                  key={i}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  Alias: {term}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button onClick={onClose} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
          Close
        </button>
      </header>
      <div className="p-4">
        {entry.data ? (
          <div className="flex flex-col gap-4 text-sm">
            {entry.data.definition ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold tracking-wide text-gray-600 dark:text-gray-300">Definition</h4>
                <MarkdownText text={decorated} onInternalLink={onInternalLink} />
              </div>
            ) : null}
            {referencedBy.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold tracking-wide text-gray-600 dark:text-gray-300">Referenced By</h4>
                <div className="space-y-2">
                  {referencedBy.map(({ code, post }) => {
                    if (!post) {
                      return (
                        <div key={code} className="flex items-center justify-between rounded-lg border px-3 py-2 dark:border-gray-800">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">{code}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Not found in archive</span>
                        </div>
                      );
                    }
                    const updated = getEntryUpdatedAt(post.entry) ?? getEntryArchivedAt(post.entry);
                    return (
                      <Link
                        key={code}
                        href={`/archives/${post.slug}`}
                        className="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold leading-tight">{post.entry.name}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <ChannelBadge ch={post.channel} />
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                              {post.entry.codes[0]}
                            </span>
                            {updated !== undefined ? <RelativeTime ts={updated} /> : null}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Open</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {entry.data.statusURL ? (
                <a
                  href={entry.data.statusURL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  View Discord Thread
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            {disableLiveFetch ? "Definition unavailable in static snapshot." : "Loading term..."}
          </div>
        )}
      </div>
    </article>
  );

  if (isInline) {
    return (
      <div className="mx-auto flex w-full max-w-3xl justify-center p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={onClose}>
      {content}
    </div>
  );
}
