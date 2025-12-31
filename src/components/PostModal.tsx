import React from "react"
import { assetURL, formatDate, getAuthorName, replaceAttachmentsInText, timeAgo, transformOutputWithReferences } from "../utils"
import { type ArchiveComment, type Author, type Image, type Reference, type StyleInfo, type IndexedPost } from "../types"
import { AttachmentCard, AuthorInline, AuthorsLine, ChannelBadge, EndorsersLine, ImageThumb, MarkdownText, RecordRenderer, TagPill } from "./ArchiveUI"

type Props = {
  active: IndexedPost
  onClose: () => void
  activeUpdatedAt?: number
  activeArchivedAt?: number
  dictionaryTooltips: Record<string, string>
  postTooltipLookup: (ref: { id: string; code?: string }) => string | undefined
  commentsByKey: Record<string, ArchiveComment[] | null>
  commentsLoading: Record<string, boolean>
  setLightbox: (img: Image | null) => void
  handleInternalLink: (url: URL) => boolean
  schemaStyles?: Record<string, StyleInfo>
}

export function PostModal({
  active,
  onClose,
  activeUpdatedAt,
  activeArchivedAt,
  dictionaryTooltips,
  postTooltipLookup,
  commentsByKey,
  commentsLoading,
  setLightbox,
  handleInternalLink,
  schemaStyles,
}: Props) {
  const key = `${active.channel.path}/${active.entry.path}`
  const comments = commentsByKey[key]
  const commentsBusy = commentsLoading[key]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={onClose}>
      <article className="max-w-3xl w-full rounded-2xl border bg-white p-0 shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <h3 className="text-lg font-bold">{active.entry.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <ChannelBadge ch={active.channel} />
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-gray-800">{active.entry.code}</span>
              {activeUpdatedAt !== undefined && <span className="text-gray-700 dark:text-gray-200" title={formatDate(activeUpdatedAt)}>Updated {timeAgo(activeUpdatedAt)}</span>}
              {activeArchivedAt !== undefined && <span className="text-gray-700 dark:text-gray-200" title={formatDate(activeArchivedAt)}>Archived {timeAgo(activeArchivedAt)}</span>}
            </div>
            {active.entry.tags && active.entry.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {active.entry.tags.map(name => (
                  <TagPill key={name} name={name} />
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Close</button>
        </header>
        <div className="p-4">
          {active.data ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <AuthorsLine authors={active.data.authors || []} />
                <EndorsersLine endorsers={active.data.endorsers || []} />
              </div>

              {active.data.images?.length ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {active.data.images.map((img) => (
                    <ImageThumb key={img.id} img={{ ...img, path: img.path ? assetURL(active.channel.path, active.entry.path, img.path) : img.path }} onClick={() => setLightbox({ ...img, path: img.path ? assetURL(active.channel.path, active.entry.path, img.path) : img.path })} />
                  ))}
                </div>
              ) : null}

              {active.data.records && (
                <div className="space-y-3">
                  <RecordRenderer
                    records={active.data.records}
                    recordStyles={active.data.styles}
                    schemaStyles={schemaStyles}
                    references={active.data.references}
                    dictionaryTooltips={dictionaryTooltips}
                    postTooltipLookup={postTooltipLookup}
                    onInternalLink={handleInternalLink}
                  />
                </div>
              )}

              {(() => {
                const acknowledgements = (active.data as { acknowledgements?: Array<Partial<Author> & { reason?: string }> }).acknowledgements || []
                if (!acknowledgements.length) return null
                const authorReferences = (active.data as { author_references?: Reference[] }).author_references
                return (
                  <Acknowledgements
                    items={acknowledgements}
                    authorReferences={authorReferences}
                    dictionaryTooltips={dictionaryTooltips}
                    postTooltipLookup={postTooltipLookup}
                    onInternalLink={handleInternalLink}
                  />
                )
              })()}

              {active.data.attachments?.length ? (
                <div>
                  <h4 className="mb-2 text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300">Attachments</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {active.data.attachments.map(att => (
                      <AttachmentCard key={att.id} att={{ ...att, path: att.path ? assetURL(active.channel.path, active.entry.path, att.path) : att.path }} onView={(img) => setLightbox(img)} />
                    ))}
                  </div>
                </div>
              ) : null}

              {commentsBusy ? (
                <div className="text-sm text-gray-500">Loading comments...</div>
              ) : comments?.length ? (
                <CommentsList
                  comments={comments}
                  channelPath={active.channel.path}
                  entryPath={active.entry.path}
                  dictionaryTooltips={dictionaryTooltips}
                  postTooltipLookup={postTooltipLookup}
                  onInternalLink={handleInternalLink}
                  setLightbox={setLightbox}
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                {active.data.post?.threadURL && (
                  <a
                    href={active.data.post.threadURL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Link to Discord Thread
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading post...</div>
          )}
        </div>
      </article>
    </div>
  )
}

function Acknowledgements({
  items,
  authorReferences,
  dictionaryTooltips,
  postTooltipLookup,
  onInternalLink,
}: {
  items: Array<Partial<Author> & { reason?: string }>
  authorReferences?: Reference[]
  dictionaryTooltips: Record<string, string>
  postTooltipLookup: (ref: { id: string; code?: string }) => string | undefined
  onInternalLink: (url: URL) => boolean
}) {
  return (
    <div>
      <h4 className="mb-2 text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300">Acknowledgements</h4>
      <ul className="space-y-3">
        {items.map((a, i) => {
          const decorated = transformOutputWithReferences(a.reason || "", authorReferences || [], (id) => dictionaryTooltips[id], postTooltipLookup).result
          const name = getAuthorName(a as Author)
          const handle = a.username && a.username !== name ? a.username : null
          const initial = name.trim().charAt(0).toUpperCase() || "?"
          const iconURL = (a as { iconURL?: string }).iconURL
          const url = (a as { url?: string }).url
          return (
            <li key={i} className="flex gap-3 rounded-xl border p-3 dark:border-gray-800">
              <div className="flex-shrink-0">
                {iconURL ? (
                  <img src={iconURL} alt={name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{initial}</span>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {url ? <a href={url} target="_blank" rel="noreferrer" className="hover:underline">{name}</a> : name}
                  </span>
                  {handle ? <span className="text-xs text-gray-500">@{handle}</span> : null}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <MarkdownText text={decorated} onInternalLink={onInternalLink} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CommentsList({
  comments,
  channelPath,
  entryPath,
  dictionaryTooltips,
  postTooltipLookup,
  onInternalLink,
  setLightbox,
}: {
  comments: ArchiveComment[]
  channelPath: string
  entryPath: string
  dictionaryTooltips: Record<string, string>
  postTooltipLookup: (ref: { id: string; code?: string }) => string | undefined
  onInternalLink: (url: URL) => boolean
  setLightbox: (img: Image | null) => void
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Comments</h4>
      <ol className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl border p-3 dark:border-gray-800">
            <div className="flex items-center justify-between gap-2">
              <AuthorInline a={c.sender} />
              <span className="text-xs text-gray-500" title={formatDate(c.timestamp)}>{timeAgo(c.timestamp)}</span>
            </div>
            {c.content && <div className="mt-2 text-sm"><MarkdownText text={
              replaceAttachmentsInText(c.content, c.attachments.map(att => ({
                ...att, path: att.path ? assetURL(channelPath, entryPath, att.path) : att.path
              })))
            } onInternalLink={onInternalLink} /></div>}
            {c.attachments?.length ? (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {c.attachments.map(att => (
                  <AttachmentCard
                    key={att.id}
                    att={{ ...att, path: att.path ? assetURL(channelPath, entryPath, att.path) : att.path }}
                    onView={(img) => setLightbox(img)}
                  />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
