import React from "react"
import { formatDate, timeAgo, transformOutputWithReferences } from "../utils"
import { type IndexedDictionaryEntry, type IndexedPost } from "../types"
import { ChannelBadge, MarkdownText } from "./ArchiveUI"

type Props = {
  activeDictionary: IndexedDictionaryEntry
  onClose: () => void
  dictionaryTooltips: Record<string, string>
  postTooltipLookup: (ref: { id: string; code?: string }) => string | undefined
  handleInternalLink: (url: URL) => boolean
  dictionaryReferencedBy: { code: string; post?: IndexedPost }[]
  openCard: (post: IndexedPost, replace?: boolean, keepView?: boolean) => void
}

export function DictionaryModal({
  activeDictionary,
  onClose,
  dictionaryTooltips,
  postTooltipLookup,
  handleInternalLink,
  dictionaryReferencedBy,
  openCard,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={onClose}>
      <article className="max-w-3xl w-full rounded-2xl border bg-white p-0 shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b p-4">
          <div className="space-y-2">
            <h3 className="text-lg font-bold">{activeDictionary.index.terms[0] || activeDictionary.index.id}</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span title={formatDate(activeDictionary.index.updatedAt)}>Updated {timeAgo(activeDictionary.index.updatedAt)}</span>
            </div>
            {activeDictionary.index.terms.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {activeDictionary.index.terms.slice(1).map((term, i) => (
                  <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">Alias: {term}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Close</button>
        </header>
        <div className="p-4">
          {activeDictionary.data ? (
            <div className="flex flex-col gap-4 text-sm">
              {activeDictionary.data.definition && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold tracking-wide text-gray-600 dark:text-gray-300">Definition</h4>
                  <MarkdownText text={transformOutputWithReferences(
                    activeDictionary.data.definition,
                    activeDictionary.data.references || [],
                    (id) => dictionaryTooltips[id],
                    postTooltipLookup,
                  ).result} onInternalLink={handleInternalLink} />
                </div>
              )}
              {dictionaryReferencedBy.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold tracking-wide text-gray-600 dark:text-gray-300">Referenced By</h4>
                  <div className="space-y-2">
                    {dictionaryReferencedBy.map(({ code, post }) => {
                      if (!post) {
                        return (
                          <div key={code} className="flex items-center justify-between rounded-lg border px-3 py-2 dark:border-gray-800">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">{code}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Not found in archive</span>
                          </div>
                        )
                      }
                      const updated = post.entry.updatedAt ?? post.entry.archivedAt ?? post.entry.timestamp
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => openCard(post, false, true)}
                          className="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                        >
                          <div className="space-y-1">
                            <div className="text-sm font-semibold leading-tight">{post.entry.name}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                              <ChannelBadge ch={post.channel} />
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">{post.entry.code}</span>
                              {updated !== undefined && <span title={formatDate(updated)}>{timeAgo(updated)}</span>}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Open</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {activeDictionary.data.threadURL && <a href={activeDictionary.data.threadURL} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Forum Thread</a>}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading term...</div>
          )}
        </div>
      </article>
    </div>
  )
}
