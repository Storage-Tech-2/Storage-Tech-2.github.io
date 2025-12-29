/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type ArchiveConfig, type ArchiveEntryData, type Attachment, type Author, type ChannelData, type ChannelRef, type DictionaryConfig, type DictionaryEntry, type DictionaryIndexEntry, type EntryRef, type SubmissionRecords, type Tag, type Image, type ArchiveComment, type StyleInfo, type Reference, ReferenceType, type ArchivedPostReference } from "./Schema";
import { assetURL, asyncPool, clsx, fetchJSONRaw, formatDate, getAuthorName, getPostTagsNormalized, getYouTubeEmbedURL, timeAgo, normalize, unique, replaceAttachmentsInText, postToMarkdown, transformOutputWithReferences } from "./Utils";
import { DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, USE_RAW } from "./Constants";
import logoimg from "./assets/logo.png";

// ------------------------------
// Data loader
// ------------------------------
export type IndexedPost = {
  channel: ChannelRef,
  entry: EntryRef,
  data?: ArchiveEntryData,
}

export type IndexedDictionaryEntry = {
  index: DictionaryIndexEntry,
  data?: DictionaryEntry,
}

const getEntryUpdatedAt = (entry: Pick<EntryRef, "updatedAt" | "archivedAt" | "timestamp">) => entry.updatedAt ?? entry.archivedAt ?? entry.timestamp
const getEntryArchivedAt = (entry: Pick<EntryRef, "updatedAt" | "archivedAt" | "timestamp">) => entry.archivedAt ?? entry.timestamp ?? entry.updatedAt

async function loadConfig(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<ArchiveConfig> {
  if (USE_RAW) return fetchJSONRaw("config.json", owner, repo, branch)
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/config.json?ref=${branch}`, {
    headers: { Accept: "application/vnd.github.raw" },
  })
  if (!res.ok) throw new Error("Failed to load config.json")
  return res.json()
}

async function loadChannelData(channel: ChannelRef, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<ChannelData> {
  const path = `${channel.path}/data.json`
  return USE_RAW ? fetchJSONRaw(path, owner, repo, branch) : (await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })).json()
}

async function loadPostData(channelPath: string, entry: EntryRef, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<ArchiveEntryData> {
  const path = `${channelPath}/${entry.path}/data.json`
  return USE_RAW ? fetchJSONRaw(path, owner, repo, branch) : (await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })).json()
}

async function loadDictionaryConfig(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<DictionaryConfig> {
  const path = `dictionary/config.json`
  return USE_RAW ? fetchJSONRaw(path, owner, repo, branch) : (await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })).json()
}

async function loadDictionaryEntry(id: string, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<DictionaryEntry> {
  const path = `dictionary/entries/${id}.json`
  return USE_RAW ? fetchJSONRaw(path, owner, repo, branch) : (await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })).json()
}

function useInView<T extends Element>(opts: IntersectionObserverInit = {}): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting)
    }, { root: opts.root || null, rootMargin: opts.rootMargin ?? "300px 0px", threshold: opts.threshold ?? 0.01 })
    io.observe(el)
    return () => io.disconnect()
  }, [opts.root, opts.rootMargin, opts.threshold])
  return [ref, inView]
}

function useArchive(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
  const [config, setConfig] = useState<ArchiveConfig | null>(null)
  const [channels, setChannels] = useState<ChannelRef[]>([])
  const [entries, setEntries] = useState<{ channel: ChannelRef, data: ChannelData }[]>([])
  const [posts, setPosts] = useState<IndexedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inflight = useRef<Map<string, Promise<IndexedPost>>>(new Map())

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        // 1) Load root config
        const cfg = await loadConfig(owner, repo, branch)
        if (cancelled) return
        setConfig(cfg)
        setChannels(cfg.archiveChannels)
        // 2) Load each channel's index (data.json)
        const channelDatas = await asyncPool(6, cfg.archiveChannels, async (ch) => {
          try {
            const cd = await loadChannelData(ch, owner, repo, branch)
            return { channel: ch, data: cd }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            console.error("Channel load failed", ch.path, e)
            return { channel: ch, data: { ...ch, currentCodeId: 0, entries: [] } as ChannelData }
          }
        })
        if (cancelled) return
        setEntries(channelDatas)
        // 3) Build an ordered list of posts with no per-post data yet
        const idx: IndexedPost[] = []
        channelDatas.forEach(({ channel, data }) => {
          data.entries.forEach((entry) => idx.push({ channel, entry }))
        })
        idx.sort((a, b) => (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0)) // newest first
        setPosts(idx)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error(e)
        setError(e.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [owner, repo, branch])

  // Lazy loader for a single post, dedup in-flight requests
  const ensurePostLoaded = async (ip: IndexedPost) => {
    if (ip.data) return ip
    const key = `${ip.channel.path}/${ip.entry.path}`
    const existing = inflight.current.get(key)
    if (existing) return existing
    const p = (async () => {
      const data = await loadPostData(ip.channel.path, ip.entry)
      ip.data = data
      setPosts((prev) => prev.map((p) => (p.entry.path === ip.entry.path && p.channel.path === ip.channel.path ? { ...p, data } : p)))
      return { ...ip, data }
    })()
    inflight.current.set(key, p)
    try { return await p } finally { inflight.current.delete(key) }
  }

  return { config, channels, entries, posts, loading, error, ensurePostLoaded }
}

function useDictionary(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
  const [config, setConfig] = useState<DictionaryConfig | null>(null)
  const [entries, setEntries] = useState<IndexedDictionaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inflight = useRef<Map<string, Promise<IndexedDictionaryEntry>>>(new Map())

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const cfg = await loadDictionaryConfig(owner, repo, branch)
        if (cancelled) return
        setConfig(cfg)
        const list = cfg.entries.map((index) => ({ index }))
        list.sort((a, b) => {
          const aTerm = (a.index.terms?.[0] || "").toLowerCase()
          const bTerm = (b.index.terms?.[0] || "").toLowerCase()
          if (aTerm && bTerm) return aTerm.localeCompare(bTerm)
          return aTerm ? -1 : bTerm ? 1 : 0
        })
        setEntries(list)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error(e)
        if (!cancelled) setError(e.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [owner, repo, branch])

  const ensureEntryLoaded = async (item: IndexedDictionaryEntry) => {
    if (item.data) return item
    const key = item.index.id
    const existing = inflight.current.get(key)
    if (existing) return existing
    const p = (async () => {
      const data = await loadDictionaryEntry(item.index.id, owner, repo, branch)
      item.data = data
      setEntries((prev) => prev.map((ent) => ent.index.id === item.index.id ? { ...ent, data } : ent))
      return { ...item, data }
    })()
    inflight.current.set(key, p)
    try { return await p } finally { inflight.current.delete(key) }
  }

  return { dictionaryConfig: config, dictionaryEntries: entries, dictionaryLoading: loading, dictionaryError: error, ensureEntryLoaded }
}

async function loadCommentsData(channelPath: string, entry: EntryRef, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<ArchiveComment[]> {
  const path = `${channelPath}/${entry.path}/comments.json`
  try {
    if (USE_RAW) return await fetchJSONRaw(path, owner, repo, branch)
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    // No comments file or fetch error — treat as no comments
    return []
  }
}

// ------------------------------
// UI components
// ------------------------------
function ChannelBadge({ ch }: { ch: ChannelRef }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700 dark:text-white" title={ch.description}>
      <span className="font-semibold">{ch.code}</span>
      <span className="text-gray-500 dark:text-white">{ch.name}</span>
    </span>
  )
}

function TagChip({ tag, state, count, onToggle }: { tag: Tag, state: -1 | 0 | 1, count?: number, onToggle?: () => void }) {
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

const SPECIAL_TAG_META: Record<string, { icon: string, classes: string }> = {
  [normalize("Untested")]: { icon: "🧪", classes: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100" },
  [normalize("Broken")]: { icon: "⛔", classes: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100" },
  [normalize("Tested & Functional")]: { icon: "✅", classes: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100" },
  [normalize("Recommended")]: { icon: "⭐", classes: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100" },
}

function getSpecialTagMeta(name: string) {
  return SPECIAL_TAG_META[normalize(name)]
}

const SPECIAL_TAG_ORDER = [
  normalize("Untested"),
  normalize("Broken"),
  normalize("Tested & Functional"),
  normalize("Recommended"),
]

function sortTagsForDisplay(names: string[]) {
  const firstByNorm: Record<string, string> = {}
  names.forEach(n => {
    const norm = normalize(n)
    if (!firstByNorm[norm]) firstByNorm[norm] = n
  })
  const specials = SPECIAL_TAG_ORDER.map(norm => firstByNorm[norm]).filter(Boolean) as string[]
  const rest = Object.entries(firstByNorm)
    .filter(([norm]) => !SPECIAL_TAG_ORDER.includes(norm))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, original]) => original)
  return [...specials, ...rest]
}

function sortTagObjectsForDisplay(tags: Tag[]) {
  const byNorm = new Map<string, Tag>()
  tags.forEach(tag => {
    const norm = normalize(tag.name)
    if (!byNorm.has(norm)) byNorm.set(norm, tag)
  })
  const specials = SPECIAL_TAG_ORDER.map(norm => byNorm.get(norm)).filter(Boolean) as Tag[]
  const rest = Array.from(byNorm.entries())
    .filter(([norm]) => !SPECIAL_TAG_ORDER.includes(norm))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, tag]) => tag)
  return [...specials, ...rest]
}

function TagPill({ name }: { name: string }) {
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

function AuthorInline({ a }: { a: Author }) {
  const name = getAuthorName(a)
  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100">
      {a.iconURL ? <img src={a.iconURL} alt="" className="h-4 w-4 rounded-full" /> : <span className="h-4 w-4 rounded-full bg-gray-300 inline-block" />}
      {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{name}</a> : name}
    </span>
  )
}

function AuthorsLine({ authors }: { authors: Author[] }) {
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

function EndorsersLine({ endorsers }: { endorsers: Author[] }) {
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

function AttachmentCard({ att, onView }: { att: Attachment, onView?: (img: Image) => void }) {
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
      {/* Media */}
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
      ) : ( // nothing to show, just a file
        null
      )}

      {/* Details */}


      {/* Body */}
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

        {/* Details */}
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


function ImageThumb({ img, onClick }: { img: Image, onClick?: () => void }) {
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

function LinkWithTooltip(props: LinkWithTooltipProps) {
  const { title, children, className, onInternalNavigate, ...rest } = props

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    const href = rest.href
    // Allow normal behavior for new-tab/middle-click/with modifier keys or external links
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

function MarkdownText({ text, onInternalLink }: { text: string, onInternalLink?: (url: URL) => boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 {...props} className="text-2xl font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h2: (props) => <h2 {...props} className="text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h3: (props) => <h3 {...props} className="text-lg font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        h4: (props) => <h4 {...props} className="text-base font-semibold tracking-wide text-gray-600 dark:text-gray-300" />,
        a: ({ node, ...props }) => {
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

function RecordRenderer({ records, recordStyles, schemaStyles, references, dictionaryTooltips, postTooltipLookup, onInternalLink }: { records: SubmissionRecords, recordStyles?: Record<string, StyleInfo>, schemaStyles?: Record<string, StyleInfo>, references?: Reference[], dictionaryTooltips?: Record<string, string>, postTooltipLookup?: (ref: ArchivedPostReference) => string | undefined, onInternalLink?: (url: URL) => boolean }) {
  const markdown = useMemo(() => postToMarkdown(records, recordStyles, schemaStyles), [records, recordStyles, schemaStyles])
  const decorated = useMemo(() => transformOutputWithReferences(markdown, references || [], (id) => dictionaryTooltips?.[id], postTooltipLookup).result, [markdown, references, dictionaryTooltips, postTooltipLookup])
  if (!decorated) return null
  return <MarkdownText text={decorated} onInternalLink={onInternalLink} />
}

function DictionaryCard({ entry, onOpen }: { entry: IndexedDictionaryEntry, onOpen: (entry: IndexedDictionaryEntry) => void }) {
  const primary = entry.index.terms[0] || entry.index.id
  const extraCount = Math.max(0, (entry.index.terms?.length || 0) - 1)
  return (
    <article className="group rounded-2xl border bg-white transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <button onClick={() => onOpen(entry)} className="block w-full text-left p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold leading-tight">{primary}</div>
            {extraCount > 0 && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400">{`+${extraCount} more ${extraCount === 1 ? "alias" : "aliases"}`}</div>
            )}
            {entry.index.summary && <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{entry.index.summary}</div>}
          </div>
        </div>
      </button>
    </article>
  )
}

// A single gallery card that lazy-loads its post when in view
function PostCard({ p, onOpen, ensurePostLoaded, sortKey }: { p: IndexedPost; onOpen: (p: IndexedPost) => void; ensurePostLoaded: (p: IndexedPost) => Promise<IndexedPost>; sortKey: SortKey }) {
  const [ref, inView] = useInView<HTMLElement>({ rootMargin: "400px 0px", threshold: 0.01 })
  useEffect(() => {
    if (inView) ensurePostLoaded(p).catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView])

  const img0 = p.data?.images?.[0]
  const src = img0 ? (img0.path ? assetURL(p.channel.path, p.entry.path, img0.path) : img0.url) : undefined

  // Pick up to two authors
  const updatedAt = getEntryUpdatedAt(p.entry)
  const archivedAt = getEntryArchivedAt(p.entry)
  const showArchivedTime = sortKey === "archived" || sortKey === "archivedOldest"
  const displayTs = showArchivedTime ? (archivedAt ?? updatedAt) : (updatedAt ?? archivedAt)
  const authors = p.data?.authors?.filter(a => !a.dontDisplay) || []
  const authorsLine = authors.length
    ? `${getAuthorName(authors[0])}${authors[1] ? ", " + getAuthorName(authors[1]) : ""}${authors.length > 2 ? ` +${authors.length - 2}` : ""}`
    : undefined

  return (
    <article ref={ref} className="group rounded-2xl border bg-white transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <button onClick={() => onOpen(p)} className="block w-full text-left">
        <div className="aspect-video w-full overflow-hidden rounded-t-2xl bg-black/5 dark:bg-white/5">
          {src ? (
            <img src={src} alt={img0?.description || img0?.name || "thumbnail"} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              {p.data ? "No image" : "Loading..."}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between">
            <h3 className="line-clamp-2 text-sm font-semibold">{p.entry.name}</h3>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">{p.entry.code}</span>
          </div>
          {authorsLine && <div className="text-xs text-gray-600 dark:text-gray-300">{authorsLine}</div>}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-200">
            <ChannelBadge ch={p.channel} />
            <div className="flex flex-col items-end text-right">
              {displayTs !== undefined && <span title={formatDate(displayTs)}>{timeAgo(displayTs)}</span>}
            </div>
          </div>
          {(p.entry.tags && p.entry.tags.length) ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {sortTagsForDisplay(p.entry.tags).map(name => <TagPill key={name} name={name} />)}
            </div>
          ) : null}
        </div>
      </button>
    </article>
  )
}

// ------------------------------
// Main app component
// ------------------------------

type SortKey = "newest" | "oldest" | "archived" | "archivedOldest" | "az"

export default function App() {
  const [owner, setOwner] = useState(DEFAULT_OWNER)
  const [repo, setRepo] = useState(DEFAULT_REPO)
  const [branch, setBranch] = useState(DEFAULT_BRANCH)

  const { config: archiveConfig, channels, posts, loading, error, ensurePostLoaded } = useArchive(owner, repo, branch)
  const { dictionaryEntries, dictionaryLoading, dictionaryError, ensureEntryLoaded: ensureDictionaryEntryLoaded } = useDictionary(owner, repo, branch)
  const postsRef = useRef<IndexedPost[]>([])
  const dictionaryEntriesRef = useRef<IndexedDictionaryEntry[]>([])

  useEffect(() => { postsRef.current = posts }, [posts])
  useEffect(() => { dictionaryEntriesRef.current = dictionaryEntries }, [dictionaryEntries])

  // UI state
  const [q, setQ] = useState("")
  const [tagMode, setTagMode] = useState<'OR' | 'AND'>('AND')
  const [tagState, setTagState] = useState<Record<string, -1 | 0 | 1>>({})
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("newest")
  const [active, setActive] = useState<IndexedPost | null>(null)
  const [activeDictionary, setActiveDictionary] = useState<IndexedDictionaryEntry | null>(null)
  const [lightbox, setLightbox] = useState<Image | null>(null)
  const [view, setView] = useState<'archive' | 'dictionary'>('archive')
  const [dictionaryQuery, setDictionaryQuery] = useState("")
  const [dictionaryDefinitions, setDictionaryDefinitions] = useState<Record<string, string>>({})
  const dictionaryFetchInFlight = useRef<Set<string>>(new Set())
  type NavigationState = {
    postId?: string,
    did?: string,
    view?: 'archive' | 'dictionary',
    keepView?: boolean,
  }

  // Comments cache keyed by `${channel.path}/${entry.path}`
  const [commentsByKey, setCommentsByKey] = useState<Record<string, ArchiveComment[] | null>>({})
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({})
  const commentsKey = (p: IndexedPost) => `${p.channel.path}/${p.entry.path}`
  const ensureCommentsLoaded = async (p: IndexedPost) => {
    const key = commentsKey(p)
    if (commentsByKey[key] !== undefined) return
    setCommentsLoading(s => ({ ...s, [key]: true }))
    try {
      const items = await loadCommentsData(p.channel.path, p.entry)
      setCommentsByKey(s => ({ ...s, [key]: items }))
    } catch (e) {
      setCommentsByKey(s => ({ ...s, [key]: [] }))
    } finally {
      setCommentsLoading(s => ({ ...s, [key]: false }))
    }
  }

  const includeTags = useMemo(() => Object.keys(tagState).filter(k => tagState[k] === 1).map(normalize), [tagState])
  const excludeTags = useMemo(() => Object.keys(tagState).filter(k => tagState[k] === -1).map(normalize), [tagState])

  function toggleTag(name: string) {
    setTagState(prev => {
      const cur = prev[name] || 0
      const next = cur === 0 ? 1 : cur === 1 ? -1 : 0
      return { ...prev, [name]: next }
    })
  }

  // Compute tag universe from channel availableTags + entry tags + any loaded post tags
  const allTags = useMemo(() => {
    const channelPool = selectedChannels.length
      ? channels.filter(ch => selectedChannels.includes(ch.code) || selectedChannels.includes(ch.name))
      : channels
    const fromChannels = channelPool.flatMap(ch => ch.availableTags || [])
    const postsPool = posts.filter(p => !selectedChannels.length || selectedChannels.includes(p.channel.code) || selectedChannels.includes(p.channel.name))
    const fromEntryRefs = postsPool.flatMap(p => p.entry.tags || [])
    const fromLoadedPosts = postsPool.flatMap(p => p.data?.tags?.map(t => t.name) || [])
    const names = unique([...fromChannels, ...fromEntryRefs, ...fromLoadedPosts])
    return sortTagObjectsForDisplay(names.map(n => ({ id: n, name: n })) as Tag[])
  }, [channels, posts, selectedChannels])

  // Counts for channels: apply search and tag filters, ignore current channel selection
  const channelCounts = useMemo(() => {
    const map: Record<string, number> = {}
    const trimmed = q.trim().toLowerCase()
    const list = posts.filter(p => {
      const postTags = getPostTagsNormalized(p)
      if (excludeTags.some(t => postTags.includes(t))) return false
      if (includeTags.length) {
        if (tagMode === 'OR' && !includeTags.some(t => postTags.includes(t))) return false
        if (tagMode === 'AND' && !includeTags.every(t => postTags.includes(t))) return false
      }
      if (!trimmed) return true
      const base = [p.entry.name, p.entry.code, p.channel.code, p.channel.name].join(' ').toLowerCase()
      const extra = [
        p.entry.tags?.join(' ') || '',
        ...(p.data ? [
          p.data.tags?.map(t => t.name).join(' ') || '',
          p.data.authors?.map(a => getAuthorName(a)).join(' ') || '',
          typeof p.data.records?.description === 'string' ? p.data.records.description : '',
        ] : []),
      ].join(' ').toLowerCase()
      return `${base} ${extra}`.includes(trimmed)
    })
    list.forEach(p => { map[p.channel.code] = (map[p.channel.code] || 0) + 1 })
    return map
  }, [posts, includeTags, excludeTags, tagMode, q])

  // Counts for tags: apply search, channel filter, and exclude tags. Do not apply include-tags to preview potential additions.
  const tagCounts = useMemo(() => {
    const map: Record<string, number> = {}
    const trimmed = q.trim().toLowerCase()
    const channelSet = selectedChannels.length ? new Set(selectedChannels) : null
    const list = posts.filter(p => {
      if (channelSet && !(channelSet.has(p.channel.code) || channelSet.has(p.channel.name))) return false
      const postTags = getPostTagsNormalized(p)
      if (excludeTags.some(t => postTags.includes(t))) return false
      if (!trimmed) return true
      const base = [p.entry.name, p.entry.code, p.channel.code, p.channel.name].join(' ').toLowerCase()
      const extra = [
        p.entry.tags?.join(' ') || '',
        ...(p.data ? [
          p.data.tags?.map(t => t.name).join(' ') || '',
          p.data.authors?.map(a => getAuthorName(a)).join(' ') || '',
          typeof p.data.records?.description === 'string' ? p.data.records.description : '',
        ] : []),
      ].join(' ').toLowerCase()
      return `${base} ${extra}`.includes(trimmed)
    })
    list.forEach(p => {
      getPostTagsNormalized(p).forEach(t => { map[t] = (map[t] || 0) + 1 })
    })
    return map
  }, [posts, selectedChannels, excludeTags, q])

  // Build a filtered list
  const filtered = useMemo(() => {
    let list = posts
    // Channel filter
    if (selectedChannels.length) {
      const set = new Set(selectedChannels)
      list = list.filter(p => set.has(p.channel.code) || set.has(p.channel.name))
    }
    // Tag include/exclude filter
    if (includeTags.length || excludeTags.length) {
      list = list.filter(p => {
        const postTags = getPostTagsNormalized(p)
        if (excludeTags.some(t => postTags.includes(t))) return false
        if (!includeTags.length) return true
        if (tagMode === 'OR') return includeTags.some(t => postTags.includes(t))
        return includeTags.every(t => postTags.includes(t))
      })
    }

    // Search
    if (q.trim()) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
      list = list.filter(p => {
        const base = [p.entry.name, p.entry.code, p.channel.code, p.channel.name].join(" ").toLowerCase()
        const extra = [
          p.entry.tags?.join(" ") || "",
          ...(p.data ? [
            p.data.tags?.map(t => t.name).join(" ") || "",
            p.data.authors?.map(a => getAuthorName(a)).join(" ") || "",
            typeof p.data.records?.description === "string" ? p.data.records.description : "",
          ] : []),
        ].join(" ").toLowerCase()
        const hay = `${base} ${extra}`
        return terms.every(t => hay.includes(t))
      })
    }
    // Sorting
    list = list.slice().sort((a, b) => {
      if (sortKey === "newest") return (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0)
      if (sortKey === "oldest") return (getEntryUpdatedAt(a.entry) ?? 0) - (getEntryUpdatedAt(b.entry) ?? 0)
      if (sortKey === "archived") return (getEntryArchivedAt(b.entry) ?? 0) - (getEntryArchivedAt(a.entry) ?? 0)
      if (sortKey === "archivedOldest") return (getEntryArchivedAt(a.entry) ?? 0) - (getEntryArchivedAt(b.entry) ?? 0)
      return a.entry.name.localeCompare(b.entry.name)
    })
    return list
  }, [posts, q, includeTags, excludeTags, selectedChannels, sortKey, tagMode])

  const filteredDictionary = useMemo(() => {
    const term = dictionaryQuery.trim().toLowerCase()
    if (!term) return dictionaryEntries
    return dictionaryEntries.filter(entry => {
      const haystack = [
        entry.index.summary || '',
        ...(entry.index.terms || []),
        entry.data?.definition || '',
      ].join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [dictionaryEntries, dictionaryQuery])

  const dictionaryTooltips = useMemo(() => {
    const map: Record<string, string> = { ...dictionaryDefinitions }
    dictionaryEntries.forEach((entry) => {
      if (map[entry.index.id]) return
      const summary = entry.index.summary?.trim()
      if (summary) map[entry.index.id] = summary
    })
    return map
  }, [dictionaryEntries, dictionaryDefinitions])

  const postsByCode = useMemo(() => {
    const map: Record<string, IndexedPost> = {}
    posts.forEach((p) => {
      if (p.entry?.code) map[p.entry.code] = p
    })
    return map
  }, [posts])
  const postsById = useMemo(() => {
    const map: Record<string, IndexedPost> = {}
    posts.forEach((p) => {
      if (p.entry?.id) map[p.entry.id] = p
    })
    return map
  }, [posts])

  const dictionaryReferencedBy = useMemo(() => {
    const codes = activeDictionary?.data?.referencedBy
    if (!codes?.length) return []
    return codes.map((code) => ({ code, post: postsByCode[code] }))
  }, [activeDictionary, postsByCode])

  const postTooltipLookup = useCallback((ref: ArchivedPostReference) => {
    const p = postsById[ref.id] || postsByCode[ref.code]
    return p?.entry?.name
  }, [postsByCode, postsById])

  // --------- URL helpers for sharable links ---------
  function buildPostURL(p: IndexedPost) {
    const url = new URL(window.location.href)
    url.searchParams.set('id', p.entry.id)
    url.searchParams.delete('did')
    url.searchParams.delete('view')
    return url.pathname + '?' + url.searchParams.toString()
  }
  function clearPostURL(replace = false) {
    const url = new URL(window.location.href)
    url.searchParams.delete('id')
    url.searchParams.delete('did')
    url.searchParams.delete('view')
    const next = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '')
    if (replace) window.history.replaceState({}, '', next); else window.history.pushState({}, '', next)
  }
  function pushPostURL(p: IndexedPost, replace = false) {
    const next = buildPostURL(p)
    const state = { postId: p.entry.id }
    if (replace) window.history.replaceState(state, '', next); else window.history.pushState(state, '', next)
  }
  function getPostFromURL(idOverride?: string): IndexedPost | undefined {
    const sp = new URLSearchParams(window.location.search)
    const id = idOverride ?? sp.get('id');
    return postsRef.current.find(p => (id && p.entry.id === id))
  }

  function buildDictionaryURL(entry: IndexedDictionaryEntry) {
    const url = new URL(window.location.href)
    url.searchParams.set('did', entry.index.id)
    url.searchParams.set('view', 'dictionary')
    url.searchParams.delete('id')
    return url.pathname + '?' + url.searchParams.toString()
  }
  function clearDictionaryURL(replace = false, keepDictionaryView = true) {
    const url = new URL(window.location.href)
    url.searchParams.delete('did')
    if (keepDictionaryView) {
      url.searchParams.set('view', 'dictionary')
    } else {
      url.searchParams.delete('view')
    }
    const nextSearch = url.searchParams.toString()
    const currentSearch = new URL(window.location.href).searchParams.toString()
    const next = url.pathname + (nextSearch ? '?' + nextSearch : '')
    if (nextSearch === currentSearch) return
    if (replace) window.history.replaceState({}, '', next); else window.history.pushState({}, '', next)
  }
  function pushDictionaryURL(entry: IndexedDictionaryEntry, replace = false) {
    const next = buildDictionaryURL(entry)
    const state = { did: entry.index.id, view: 'dictionary' }
    if (replace) window.history.replaceState(state, '', next); else window.history.pushState(state, '', next)
  }
  function getDictionaryFromURL(didOverride?: string): IndexedDictionaryEntry | undefined {
    const sp = new URLSearchParams(window.location.search)
    const did = didOverride ?? sp.get('did');
    if (!did) return undefined
    return dictionaryEntriesRef.current.find(p => p.index.id === did) || {
      index: { id: did, terms: [did], summary: "", updatedAt: Date.now() },
    }
  }

  const switchToArchiveView = (replace = false) => {
    setView('archive')
    setActiveDictionary(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('view')
    url.searchParams.delete('did')
    const next = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '')
    if (replace) window.history.replaceState({ view: 'archive' }, '', next); else window.history.pushState({ view: 'archive' }, '', next)
  }

  const switchToDictionaryView = (replace = false) => {
    setView('dictionary')
    setActive(null)
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'dictionary')
    url.searchParams.delete('id')
    const next = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '')
    if (replace) window.history.replaceState({ view: 'dictionary' }, '', next); else window.history.pushState({ view: 'dictionary' }, '', next)
  }

  // Open modal and update URL
  async function openCard(p: IndexedPost, replace = false) {
    const loaded = await ensurePostLoaded(p)
    setView('archive')
    setActiveDictionary(null)
    setActive(loaded)
    pushPostURL(loaded, replace)
    // kick off lazy comments fetch without blocking the modal
    ensureCommentsLoaded(loaded).catch(() => { })
  }
  function closeModal(pushHistory = true) {
    setActive(null)
    if (pushHistory) clearPostURL()
  }

  async function openDictionaryEntry(entry: IndexedDictionaryEntry, replace = false, keepView = false, updateURL = true) {
    // show modal immediately to avoid flicker while data loads
    setActiveDictionary(entry)
    if (!keepView) setView('dictionary')
    setActive(null)
    const loaded = await ensureDictionaryEntryLoaded(entry)
    setActiveDictionary(loaded)
    if (updateURL) pushDictionaryURL(loaded, replace)
  }
  function closeDictionaryModal(pushHistory = true) {
    setActiveDictionary(null)
    if (pushHistory) clearDictionaryURL(false, view === 'dictionary')
  }

  const handleInternalLink = useCallback((url: URL) => {
    if (url.origin !== window.location.origin) return false
    const did = url.searchParams.get('did')
    if (did) {
      const keepView = view === 'archive'
      const targetDict = getDictionaryFromURL(did)
      const state: NavigationState = { did, view: keepView ? 'archive' : 'dictionary', keepView }
      if (keepView) {
        window.history.pushState(state, '', window.location.href)
      } else {
        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.set('did', did)
        nextUrl.searchParams.set('view', 'dictionary')
        nextUrl.searchParams.delete('id')
        window.history.pushState(state, '', nextUrl.toString())
      }
      if (targetDict) openDictionaryEntry(targetDict, false, keepView, false)
      return true
    }
    const postId = url.searchParams.get('id')
    if (postId) {
      const targetPost = posts.find(p => p.entry.id === postId)
      if (targetPost) {
        openCard(targetPost, false)
        return true
      }
      return false
    }
    return false
  }, [view, posts, openCard, getDictionaryFromURL])

  // Handle body overflow hidden when modal open
  useEffect(() => {
    if (active || activeDictionary) {
      document.body.classList.add('overflow-hidden')
    } else {
      document.body.classList.remove('overflow-hidden')
    }
    return () => { document.body.classList.remove('overflow-hidden') }
  }, [active, activeDictionary])

  // Update page title based on visible content
  useEffect(() => {
    const baseTitle = "Storage Tech 2"
    if (active?.entry) {
      const code = active.entry.code ? ` (${active.entry.code})` : ""
      document.title = `${active.entry.name}${code} | ${baseTitle}`
      return
    }
    if (activeDictionary?.index) {
      const term = activeDictionary.index.terms[0] || activeDictionary.index.id
      document.title = `${term} - Dictionary | ${baseTitle}`
      return
    }
    const viewTitle = view === 'dictionary' ? "Dictionary" : "Archive"
    document.title = `${viewTitle} | ${baseTitle}`
  }, [active, activeDictionary, view])

  // Handle initial URL and back/forward navigation
  const urlStateApplied = useRef(false)
  useEffect(() => { urlStateApplied.current = false }, [owner, repo, branch])

  useEffect(() => {
    const applyURLState = async (replace = false, navState?: NavigationState | null) => {
      const sp = new URLSearchParams(window.location.search)
      const postId = navState?.postId ?? sp.get('id') ?? undefined
      const didParam = navState?.did ?? sp.get('did') ?? undefined
      const keepView = navState?.keepView ?? false
      const viewParam = navState?.view ?? sp.get('view')
      const wantsDictionary = !!didParam || viewParam === 'dictionary'
      const targetView = keepView ? 'archive' : (wantsDictionary ? 'dictionary' : 'archive')
      setView(targetView)
      if (targetView === 'dictionary' && !keepView) {
        const targetDict = getDictionaryFromURL(didParam)
        if (targetDict) { await openDictionaryEntry(targetDict, replace, false, false) } else { setActiveDictionary(null) }
        setActive(null)
        return
      }
      const targetPost = postId ? getPostFromURL(postId) : undefined
      if (targetPost) { await openCard(targetPost, replace) } else { setActive(null) }
      if (didParam) {
        const targetDict = getDictionaryFromURL(didParam)
        if (targetDict) { await openDictionaryEntry(targetDict, replace, true, false) } else { setActiveDictionary(null) }
      } else {
        setActiveDictionary(null)
      }
    }
    const onPop = (evt: PopStateEvent) => {
      const navState = (evt.state ?? window.history.state ?? null) as NavigationState | null
      applyURLState(true, navState).catch(() => { })
    }
    const sp = new URLSearchParams(window.location.search)
    const navState = (window.history.state || null) as NavigationState | null
    const wantsPost = !!(navState?.postId ?? sp.get('id'))
    const wantsDictionary = !!(navState?.did ?? sp.get('did')) || navState?.view === 'dictionary' || sp.get('view') === 'dictionary'
    const dataReady = (!wantsPost || postsRef.current.length > 0) && (!wantsDictionary || dictionaryEntriesRef.current.length > 0)
    if (!urlStateApplied.current && dataReady) {
      urlStateApplied.current = true
      applyURLState(true, navState).catch(() => { })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // We want to rerun when the set of posts changes or after initial load
  }, [posts.length, dictionaryEntries.length])

  const activeUpdatedAt = active ? getEntryUpdatedAt(active.entry) : undefined
  const activeArchivedAt = active ? getEntryArchivedAt(active.entry) : undefined
  const schemaStyles = useMemo(() => (archiveConfig as unknown as { postStyles?: Record<string, StyleInfo> })?.postStyles, [archiveConfig])

  useEffect(() => {
    const targetIds = new Set<string>()
    const addRefs = (refs?: Reference[]) => {
      refs?.forEach(ref => {
        if (ref.type === ReferenceType.DICTIONARY_TERM) targetIds.add(ref.id)
      })
    }
    addRefs(active?.data?.references)
    addRefs(active?.data?.author_references)
    if (!targetIds.size) return
    targetIds.forEach(async (id) => {
      if (dictionaryDefinitions[id] || dictionaryFetchInFlight.current.has(id)) return
      dictionaryFetchInFlight.current.add(id)
      try {
        const entryInList = dictionaryEntries.find(e => e.index.id === id)
        const summary = entryInList?.index.summary?.trim()
        if (summary) setDictionaryDefinitions((prev) => prev[id] ? prev : { ...prev, [id]: summary })
      } catch {
        // ignore fetch errors
      } finally {
        dictionaryFetchInFlight.current.delete(id)
      }
    })
  }, [active, dictionaryEntries, dictionaryDefinitions, owner, repo, branch])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Header */}
      <header className="sm:sticky top-0 z-20 border-b bg-white/80 backdrop-blur dark:bg-gray-900/80">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pb-1">
            <div className="flex items-center gap-3 flex-shrink-0">
              <img src={logoimg} alt="Logo" className="h-10 w-10" />
              <div>
                <div className="text-xl font-bold"><a href="/">Storage Tech 2</a></div>
                <div className="text-xs text-gray-500"><a href="https://github.com/Storage-Tech-2/Archive">{owner}/{repo}@{branch}</a></div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => switchToArchiveView()} className={clsx("rounded-xl border px-3 py-2 text-sm", view === 'archive' ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-white dark:bg-gray-900")}>Archive</button>
              <button onClick={() => switchToDictionaryView()} className={clsx("rounded-xl border px-3 py-2 text-sm", view === 'dictionary' ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-white dark:bg-gray-900")}>Dictionary</button>
            </div>

            {view === 'archive' ? (
              <>
                <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search posts, codes, tags, authors" className="w-full rounded-xl border px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900" />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
                </div>
                <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="rounded-xl border px-3 py-2 bg-white dark:bg-gray-900 flex-shrink-0">
                  <option value="newest">Updated (newest)</option>
                  <option value="oldest">Updated (oldest)</option>
                  <option value="archived">Archived (newest)</option>
                  <option value="archivedOldest">Archived (oldest)</option>
                  <option value="az">A to Z</option>
                </select>
              </>
            ) : (
              <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                <input value={dictionaryQuery} onChange={e => setDictionaryQuery(e.target.value)} placeholder="Search dictionary terms" className="w-full rounded-xl border px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900" />
                <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
              </div>
            )}

            <a href="https://discord.gg/hztJMTsx2m" target="_blank" rel="noreferrer" className="flex-shrink-0 rounded-xl border px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
              Join Discord
            </a>
          </div>
        </div>
      </header>

      {view === 'archive' ? (
        <>
          {/* Filters */}
          <div className="mx-auto max-w-7xl px-4 py-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Channels</span>
                <div className="flex flex-wrap gap-2">
                  {channels.map(ch => (
                    <label key={ch.code} title={ch.description} className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs cursor-pointer", selectedChannels.includes(ch.code) ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-black" : "")}>
                      <input type="checkbox" className="hidden" checked={selectedChannels.includes(ch.code)} onChange={() => setSelectedChannels(s => s.includes(ch.code) ? s.filter(x => x !== ch.code) : [...s, ch.code])} />
                      <span className="font-semibold">{ch.code}</span>
                      <span className={selectedChannels.includes(ch.code) ? "text-white dark:text-black" : "text-gray-500 dark:text-white"}>{ch.name}</span>
                      <span className="ml-1 rounded bg-black/10 px-1 text-[10px] dark:bg-white/10">{channelCounts[ch.code] || 0}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">Tags</span>
                <div className="inline-flex items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="tagMode" value="AND" checked={tagMode === 'AND'} onChange={() => setTagMode('AND')} />
                    <span>Match all</span>
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="tagMode" value="OR" checked={tagMode === 'OR'} onChange={() => setTagMode('OR')} />
                    <span>Match any</span>
                  </label>
                  <span className="text-gray-500">Tip: click tag twice to exclude</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <TagChip key={tag.id} tag={tag} state={tagState[tag.name] || 0} count={tagCounts[normalize(tag.name)] || 0} onToggle={() => toggleTag(tag.name)} />
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="mx-auto max-w-7xl px-4">
            {error && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            {loading && <div className="mb-3 rounded-lg border bg-white p-3 text-sm dark:bg-gray-900">Loading repository metadata...</div>}
          </div>

          {/* Gallery */}
          <main className="mx-auto max-w-7xl px-4 pb-12">
            <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">Showing {filtered.length} of {posts.length} posts</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <PostCard key={`${p.channel.path}/${p.entry.path}`} p={p} onOpen={openCard} ensurePostLoaded={ensurePostLoaded} sortKey={sortKey} />
              ))}
            </div>
          </main>
        </>
      ) : (
        <>
          <div className="mx-auto max-w-7xl px-4 py-3">
            {dictionaryError && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{dictionaryError}</div>}
            {dictionaryLoading && <div className="mb-3 rounded-lg border bg-white p-3 text-sm dark:bg-gray-900">Loading dictionary...</div>}
          </div>
          <main className="mx-auto max-w-7xl px-4 pb-12">
            <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">Showing {filteredDictionary.length} of {dictionaryEntries.length} terms</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDictionary.map((entry) => (
                <DictionaryCard key={entry.index.id} entry={entry} onOpen={openDictionaryEntry} />
              ))}
            </div>
          </main>
        </>
      )}

      {/* Details modal */}
      {view === 'archive' && active && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={() => closeModal()}>
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
                    {sortTagsForDisplay(active.entry.tags || []).map(name => (
                      <TagPill key={name} name={name} />
                    ))}
                  </div>
                )}
            </div>
              <button onClick={() => closeModal()} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Close</button>
            </header>
            <div className="p-4">
              {active.data ? (
                <div className="flex flex-col gap-4">
                  {/* authors */}
                  <div className="flex flex-col gap-1">
                    <AuthorsLine authors={active.data.authors || []} />
                    <EndorsersLine endorsers={active.data.endorsers || []} />
                  </div>

                  {/* images */}
                  {active.data.images?.length ? (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {active.data.images.map((img) => (
                        <ImageThumb key={img.id} img={{ ...img, path: img.path ? assetURL(active.channel.path, active.entry.path, img.path) : img.path }} onClick={() => setLightbox({ ...img, path: img.path ? assetURL(active.channel.path, active.entry.path, img.path) : img.path })} />
                      ))}
                    </div>
                  ) : null}

                  {/* records */}
                  {active.data.records ? (
                    <RecordRenderer
                      records={active.data.records}
                      recordStyles={active.data.styles}
                      schemaStyles={schemaStyles}
                      references={active.data.references}
                      dictionaryTooltips={dictionaryTooltips}
                      postTooltipLookup={postTooltipLookup}
                      onInternalLink={handleInternalLink}
                    />
                  ) : null}

                  {/* acknowledgements */}
                  {(() => {
                    const list = (active.data.authors || []).filter(a => typeof a.reason === 'string' && a.reason.trim().length > 0)
                    if (!list.length) return null
                    return (
                      <div>
                        <h4 className="mb-2 text-xl font-semibold tracking-wide text-gray-600 dark:text-gray-300">Acknowledgements</h4>
                        <ul className="space-y-3">
                          {list.map((a, i) => {
                            const decorated = transformOutputWithReferences(a.reason || "", active.data.author_references || [], (id) => dictionaryTooltips[id], postTooltipLookup).result
                            const name = getAuthorName(a)
                            const handle = a.username && a.username !== name ? a.username : null
                            const initial = name.trim().charAt(0).toUpperCase() || '?'
                            return (
                              <li key={i} className="flex gap-3 rounded-xl border p-3 dark:border-gray-800">
                                <div className="flex-shrink-0">
                                  {a.iconURL ? (
                                    <img src={a.iconURL} alt={name} className="h-10 w-10 rounded-full object-cover" />
                                  ) : (
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{initial}</span>
                                  )}
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                      {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{name}</a> : name}
                                    </span>
                                    {handle ? <span className="text-xs text-gray-500">@{handle}</span> : null}
                                  </div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300">
                                    <MarkdownText text={decorated} onInternalLink={handleInternalLink} />
                                  </div>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })()}

                  {/* attachments */}
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
                  {(() => {
                    const key = `${active.channel.path}/${active.entry.path}`
                    const items = commentsByKey[key]
                    const loadingC = commentsLoading[key]
                    if (loadingC) return <div className="text-sm text-gray-500">Loading comments...</div>
                    if (!items || items.length === 0) return null
                    return (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Comments</h4>
                        <ol className="space-y-3">
                          {items.map((c) => (
                            <li key={c.id} className="rounded-xl border p-3 dark:border-gray-800">
                              <div className="flex items-center justify-between gap-2">
                                <AuthorInline a={c.sender} />
                                <span className="text-xs text-gray-500" title={formatDate(c.timestamp)}>{timeAgo(c.timestamp)}</span>
                              </div>
                              {c.content && <div className="mt-2 text-sm"><MarkdownText text={
                                replaceAttachmentsInText(c.content, c.attachments.map(att => ({
                                  ...att, path: att.path ? assetURL(active.channel.path, active.entry.path, att.path) : att.path
                                })))
                              } onInternalLink={handleInternalLink} /></div>}
                              {c.attachments?.length ? (
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {c.attachments.map(att => (
                                    <AttachmentCard
                                      key={att.id}
                                      att={{ ...att, path: att.path ? assetURL(active.channel.path, active.entry.path, att.path) : att.path }}
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
                  })()}
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
      )}

      {activeDictionary && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={() => closeDictionaryModal()}>
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
              <button onClick={() => closeDictionaryModal()} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Close</button>
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
                          const updated = getEntryUpdatedAt(post.entry)
                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => openCard(post)}
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
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.path ? lightbox.path : lightbox.url} alt={lightbox.description || lightbox.name} className="max-h-[80vh] w-full object-contain rounded-2xl" />
            <div className="mt-2 flex items-center justify-between text-sm text-white">
              <div className="opacity-80">{lightbox.description || lightbox.name}</div>
              <div className="flex items-center gap-2">
                <a href={lightbox.path ? lightbox.path : lightbox.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/40 px-3 py-1">Open in new tab</a>
                <button onClick={() => setLightbox(null)} className="rounded-full border border-white/40 px-3 py-1">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        Built for the Storage Tech 2 archive. Copyright © 2025 All rights reserved.
      </footer>
    </div>
  )
}
