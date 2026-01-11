'use client';

import { MarkdownText } from "./ui";
import { formatDate, timeAgo } from "@/lib/utils/dates";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { type IndexedDictionaryEntry } from "@/lib/types";
import { transformOutputWithReferences } from "@/lib/utils/references";

type Props = {
  entry: IndexedDictionaryEntry;
  onClose: () => void;
  dictionaryTooltips?: Record<string, string>;
};

export function DictionaryModal({ entry, onClose, dictionaryTooltips }: Props) {
  const decorated = entry.data
    ? transformOutputWithReferences(entry.data.definition, entry.data.references || [], (id) => dictionaryTooltips?.[id]).result
    : "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={onClose}>
      <article
        className="w-full max-w-3xl rounded-2xl border bg-white p-0 shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b p-4">
          <div className="space-y-2">
            <h3 className="text-lg font-bold">{entry.index.terms[0] || entry.index.id}</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span title={formatDate(entry.index.updatedAt)}>Updated {timeAgo(entry.index.updatedAt)}</span>
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
                  <MarkdownText text={decorated} />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {entry.data.threadURL ? (
                  <a
                    href={entry.data.threadURL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Forum Thread
                  </a>
                ) : null}
                {entry.data.statusURL ? (
                  <a
                    href={entry.data.statusURL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Status
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
    </div>
  );
}
