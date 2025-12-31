import React, { useEffect, useMemo, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getEntryArchivedAt, getEntryUpdatedAt, type IndexedDictionaryEntry, type IndexedPost, type SortKey } from "../types"
import { useInView } from "../hooks/useInView"
import { assetURL, clsx, formatDate, getAuthorName, getYouTubeEmbedURL, postToMarkdown, timeAgo, transformOutputWithReferences } from "../utils"
import { type Attachment, type Author, type Image, type Reference, type StyleInfo, type SubmissionRecords, type Tag, type ArchivedPostReference } from "../types"
import { getSpecialTagMeta, sortTagsForDisplay } from "../utils/tagDisplay"

export function ChannelBadge({ ch }: { ch: { code: string, name: string, description?: string } }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700 dark:text-white" title={ch.description}>
      <span className="font-semibold">{ch.code}</span>
      <span className="text-gray-500 dark:text-white">{ch.name}</span>
    </span>
  )
}

export function TagChip({ tag, state, count, onToggle }: { tag: Tag, state: -1 | 0 | 1, count?: number, onToggle?: () => void }) {
  const meta = getSpecialTagMeta(tag.name)
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
  const cls = state === 1
    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
    : state === -1
      ? "bg-red-600 text-white border-red-600 shadow-sm"
      : meta
        ? meta.classes
        : "text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900"
  return (
    <button onClick={onToggle} className={clsx(base, cls)} title={state === -1 ? "Excluded" : state === 1 ? "Included" : "Not selected"}>
      {meta?.icon && <span className="text-[12px]">{meta.icon}</span>}
      <span>{tag.name}</span>
      {typeof count === 'number' && <span className="rounded bg-black/10 px-1 text-[10px] dark:bg-white/10">{count}</span>}
    </button>
  )
}

export function TagPill({ name }: { name: string }) {
  const meta = getSpecialTagMeta(name)
  const base = "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
  const cls = meta ? meta.classes : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  return (
    <span className={clsx(base, cls)}>
      {meta?.icon && <span className="text-[12px]">{meta.icon}</span>}
      <span>{name}</span>
    </span>
  )
}

export function AuthorsLine({ authors }: { authors: Author[] }) {
  const visible = authors?.filter(a => !a.dontDisplay) || []
  if (!visible.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <span className="font-medium">Authors:</span>
      {visible.slice(0, 3).map((a, i) => <AuthorInline key={`au-${i}`} a={a} />)}
      {visible.length > 3 && <span>+{visible.length - 3}</span>}
    </div>
  )
}

export function EndorsersLine({ endorsers }: { endorsers: Author[] }) {
  const vis = endorsers || []
  if (!vis.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
      <span className="font-medium">Endorsed by:</span>
      {vis.slice(0, 4).map((a, i) => <AuthorInline key={`en-${i}`} a={a} />)}
      {vis.length > 4 && <span>+{vis.length - 4}</span>}
    </div>
  )
}

export function AuthorInline({ a }: { a: Author }) {
  const name = getAuthorName(a)
  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100">
      {a.iconURL ? <img src={a.iconURL} alt="" className="h-4 w-4 rounded-full" /> : <span className="h-4 w-4 rounded-full bg-gray-300 inline-block" />}
      {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{name}</a> : name}
    </span>
  )
}

export function AttachmentCard({ att, onView }: { att: Attachment, onView?: (img: Image) => void }) {
  const href = (att.path && att.canDownload) ? att.path : att.url
  const kind = att.youtube ? "YouTube" : att.litematic ? "Litematic" : att.wdl ? "WDL" : (att.contentType?.toUpperCase() || "FILE")
  const ext = (att.name?.split('.')?.pop() || '').toUpperCase()
  const title = att.youtube?.title || att.name
  const embedSrc = att.youtube ? getYouTubeEmbedURL(att.url) : null
  const isImage = (att.contentType?.startsWith('image/')) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.name || '')
  const imageForView: Image = {
    id: att.id,
    name: att.name,
    url: href,
    description: att.description,
    contentType: att.contentType,
    canDownload: att.canDownload,
    path: att.path,
  }
  return (
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
              <img src={att.youtube!.thumbnail_url} alt={title} className="aspect-video w-full object-contain" />
            </a>
          )}
        </div>
      ) : null}
      {isImage && onView && att.canDownload ? (
        <ImageThumb img={imageForView} onClick={() => onView(imageForView)} />
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-200">{kind}{ext && !att.youtube ? ` · ${ext}` : ''}</span>
        </div>
        <h5 className="text-sm font-semibold leading-snug break-words">{title}</h5>
        {!att.youtube && (
          <div className="text-[11px] text-gray-500 break-words">{att.name}</div>
        )}
        {att.description && (
          <div className="text-xs text-gray-700 dark:text-gray-300 break-words">{att.description}</div>
        )}

        {att.litematic && (
          <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {att.litematic.version && <li><span className="font-medium">Version:</span> {att.litematic.version}</li>}
            {att.litematic.size && <li><span className="font-medium">Size:</span> {att.litematic.size}</li>}
            {att.litematic.error && <li className="text-red-600">{att.litematic.error}</li>}
          </ul>
        )}
        {att.wdl && (
          <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {att.wdl.version && <li><span className="font-medium">Minecraft:</span> {att.wdl.version}</li>}
            {att.wdl.error && <li className="text-red-600">{att.wdl.error}</li>}
          </ul>
        )}
        {att.youtube && (
          <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            <li><span className="font-medium">By:</span> {att.youtube.author_url ? (<a className="underline" href={att.youtube.author_url} target="_blank" rel="noreferrer">{att.youtube.author_name}</a>) : att.youtube.author_name}</li>
            {(att.youtube.width && att.youtube.height) ? <li><span className="font-medium">Resolution:</span> {att.youtube.width}×{att.youtube.height}</li> : null}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {att.litematic ? (
            <a href={`https://schemat.io/view?url=${att.path}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">View on Schemat.io</a>
          ) : null}
          {att.canDownload ? (
            <a href={href} download className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Download</a>
          ) : (
            <a href={href} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Open</a>
          )}
        </div>
      </div>
    </article>
  )
}

export function ImageThumb({ img, onClick }: { img: Image, onClick?: () => void }) {
  const src = img.path ? img.path : img.url
  return (
    <button className="block overflow-hidden rounded-lg border bg-black/5 dark:bg-white/5" onClick={onClick} title={img.description}>
      <img src={src} alt={img.description || img.name} className="h-40 w-full object-contain" />
    </button>
  )
}

type LinkWithTooltipProps = React.ComponentProps<"a"> & {
  onInternalNavigate?: (url: URL) => boolean,
}

export function LinkWithTooltip(props: LinkWithTooltipProps) {
  const { title, children, className, onInternalNavigate, ...rest } = props

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    const href = rest.href
    if (!href || rest.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    try {
      const url = new URL(href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (onInternalNavigate && onInternalNavigate(url)) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      window.history.pushState({}, '', url.href)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      // fall back to default navigation
    }
  }
  return (
    <span className="relative group inline-block">
      <a {...rest} onClick={handleClick} className={clsx("underline", className)}>{children}</a>
      {title ? (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-64 -translate-x-1/2 rounded-md bg-black px-3 py-2 text-sm text-white shadow-lg group-hover:block">
          {title}
        </span>
      ) : null}
    </span>
  )
}

function linkTargetForHref(href?: string) {
  if (!href) return undefined
  try {
    const url = new URL(href, window.location.href)
    return url.origin === window.location.origin ? undefined : "_blank"
  } catch {
    return "_blank"
  }
}

export function MarkdownText({ text, onInternalLink }: { text: string, onInternalLink?: (url: URL) => boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 {...props} className="text-2xl font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h2: (props) => <h2 {...props} className="text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h3: (props) => <h3 {...props} className="text-lg font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h4: (props) => <h4 {...props} className="text-base font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        a: (props) => {
          const target = linkTargetForHref(props.href)
          return <LinkWithTooltip {...props} onInternalNavigate={onInternalLink} target={target} rel={target === "_blank" ? "noreferrer" : undefined} />
        },
        p: (props) => <p {...props} className="leading-relaxed whitespace-pre-wrap" />,
        ul: (props) => <ul {...props} className="list-disc ml-5" />,
        ol: (props) => <ol {...props} className="list-decimal ml-5" />,
        code: (props) => <code {...props} className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800" />,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

export function RecordRenderer({ records, recordStyles, schemaStyles, references, dictionaryTooltips, postTooltipLookup, onInternalLink }: { records: SubmissionRecords, recordStyles?: Record<string, StyleInfo>, schemaStyles?: Record<string, StyleInfo>, references?: Reference[], dictionaryTooltips?: Record<string, string>, postTooltipLookup?: (ref: ArchivedPostReference) => string | undefined, onInternalLink?: (url: URL) => boolean }) {
  const markdown = useMemo(() => postToMarkdown(records, recordStyles, schemaStyles), [records, recordStyles, schemaStyles])
  const decorated = useMemo(() => transformOutputWithReferences(markdown, references || [], (id) => dictionaryTooltips?.[id], postTooltipLookup).result, [markdown, references, dictionaryTooltips, postTooltipLookup])
  if (!decorated) return null
  return <MarkdownText text={decorated} onInternalLink={onInternalLink} />
}

export function DictionaryCard({ entry, onOpen }: { entry: IndexedDictionaryEntry, onOpen: (entry: IndexedDictionaryEntry) => void }) {
  const primary = entry.index.terms[0] || entry.index.id
  const extraCount = Math.max(0, (entry.index.terms?.length || 0) - 1)
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group flex h-full w-full flex-col items-start rounded-2xl border bg-white text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="p-4 text-left">
        <div className="space-y-1">
          <div className="text-sm font-semibold leading-tight">{primary}</div>
          {extraCount > 0 && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400">{`+${extraCount} more ${extraCount === 1 ? "alias" : "aliases"}`}</div>
          )}
          {entry.index.summary && <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{entry.index.summary}</div>}
        </div>
      </div>
    </button>
  )
}

export function PostCard({ p, onOpen, ensurePostLoaded, sortKey, onHeightChange }: { p: IndexedPost; onOpen: (p: IndexedPost) => void; ensurePostLoaded: (p: IndexedPost) => Promise<IndexedPost>; sortKey: SortKey; onHeightChange?: () => void }) {
  const [ref, inView] = useInView<HTMLElement>({ rootMargin: "400px 0px", threshold: 0.01 })
  const heightChangeRef = useRef(onHeightChange)

  useEffect(() => {
    heightChangeRef.current = onHeightChange
  }, [onHeightChange])

  useEffect(() => {
    if (inView) ensurePostLoaded(p).catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView])

  useEffect(() => {
    heightChangeRef.current?.()
  }, [p.data])

  const img0 = p.data?.images?.[0]
  const src = img0 ? (img0.path ? assetURL(p.channel.path, p.entry.path, img0.path) : img0.url) : undefined

  const updatedAt = getEntryUpdatedAt(p.entry)
  const archivedAt = getEntryArchivedAt(p.entry)
  const showArchivedTime = sortKey === "archived" || sortKey === "archivedOldest"
  const displayTs = showArchivedTime ? (archivedAt ?? updatedAt) : (updatedAt ?? archivedAt)
  const authors = p.data?.authors?.filter(a => !a.dontDisplay) || []
  const authorsLine = authors.length
    ? `${getAuthorName(authors[0])}${authors[1] ? ", " + getAuthorName(authors[1]) : ""}${authors.length > 2 ? ` +${authors.length - 2}` : ""}`
    : undefined

  return (
    <article ref={ref} className="group flex h-full flex-col rounded-2xl border bg-white transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <button onClick={() => onOpen(p)} className="flex h-full w-full flex-col text-left">
        <div className="aspect-video w-full overflow-hidden rounded-t-2xl bg-black/5 dark:bg-white/5">
          {src ? (
            <img src={src} alt={img0?.description || img0?.name || "thumbnail"} className="h-full w-full object-contain" onLoad={() => heightChangeRef.current?.()} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              {p.data ? "No image" : "Loading..."}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold">{p.entry.name}</h3>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">{p.entry.code}</span>
          </div>
          {authorsLine ? (
            <div className="text-xs text-gray-600 dark:text-gray-300 min-h-[16px]">{authorsLine}</div>
          ) : (
            <div className="min-h-[16px]" />
          )}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-200">
            <ChannelBadge ch={p.channel} />
            <div className="flex flex-col items-end text-right">
              {displayTs !== undefined && <span title={formatDate(displayTs)}>{timeAgo(displayTs)}</span>}
            </div>
          </div>
          {(p.entry.tags && p.entry.tags.length) ? (
            <div className="mt-1 flex flex-wrap gap-1 min-h-[28px]">
              {sortTagsForDisplay(p.entry.tags).map(name => <TagPill key={name} name={name} />)}
            </div>
          ) : (
            <div className="mt-1 min-h-[28px]" />
          )}
        </div>
      </button>
    </article>
  )
}
