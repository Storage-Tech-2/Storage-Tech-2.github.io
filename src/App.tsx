/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AuthorType, type ArchiveConfig, type ArchiveEntryData, type Attachment, type Author, type ChannelData, type ChannelRef, type EntryRef, type NestedListItem, type SubmissionRecord, type SubmissionRecords, type Tag, type Image, type ArchiveComment } from "./Schema";
import { assetURL, asyncPool, clsx, fetchJSONRaw, formatDate, getAuthorName, getPostTagsNormalized, getYouTubeEmbedURL, timeAgo, normalize, unique, replaceAttachmentsInText } from "./Utils";
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
        idx.sort((a, b) => b.entry.timestamp - a.entry.timestamp) // newest first
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
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200" title={ch.description}>
      <span className="font-semibold">{ch.code}</span>
      <span className="text-gray-500">{ch.name}</span>
    </span>
  )
}

function TagChip({ tag, state, count, onToggle }: { tag: Tag, state: -1 | 0 | 1, count?: number, onToggle?: () => void }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
  const cls = state === 1
    ? "bg-blue-600 text-white border-blue-600"
    : state === -1
      ? "bg-red-600 text-white border-red-600"
      : "text-gray-700 dark:text-gray-200"
  return (
    <button onClick={onToggle} className={clsx(base, cls)} title={state === -1 ? "Excluded" : state === 1 ? "Included" : "Not selected"}>
      <span>{tag.name}</span>
      {typeof count === 'number' && <span className="rounded bg-black/10 px-1 text-[10px] dark:bg-white/10">{count}</span>}
    </button>
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
      {isImage && onView ? (
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

function MarkdownText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: (props) => <a {...props} target="_blank" rel="noreferrer" className="underline" />,
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

function RecordRenderer({ records }: { records: SubmissionRecords }) {
  const entries = Object.entries(records)
  return (
    <div className="flex flex-col gap-4">
      {entries.map(([key, value]) => (
        <section key={key} className="">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{key}</h4>
          <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
            <RecordValue value={value} />
          </div>
        </section>
      ))}
    </div>
  )
}

function RecordValue({ value }: { value: SubmissionRecord }) {
  if (typeof value === "string") return <MarkdownText text={value} />
  // Array form: render as a list so list-like records show as lists
  const items = value
  return (
    <ul className="ml-5 list-disc space-y-1">
      {items.map((item, idx) => (
        typeof item === "string" ? (
          <li key={idx}><MarkdownText text={item} /></li>
        ) : (
          <li key={idx}><NestedList item={item} /></li>
        )
      ))}
    </ul>
  )
}

function NestedList({ item }: { item: NestedListItem }) {
  const ListTag = item.isOrdered ? "ol" : "ul"
  return (
    <div className="">
      {item.title && <div className="font-medium">{item.title}</div>}
      <ListTag className={clsx("ml-5 list-inside", item.isOrdered ? "list-decimal" : "list-disc")}>
        {item.items.map((i, idx) => (
          typeof i === "string" ? <li key={idx}><MarkdownText text={i} /></li> : <li key={idx}><NestedList item={i} /></li>
        ))}
      </ListTag>
    </div>
  )
}

// A single gallery card that lazy-loads its post when in view
function PostCard({ p, onOpen, ensurePostLoaded }: { p: IndexedPost; onOpen: (p: IndexedPost) => void; ensurePostLoaded: (p: IndexedPost) => Promise<IndexedPost> }) {
  const [ref, inView] = useInView<HTMLElement>({ rootMargin: "400px 0px", threshold: 0.01 })
  useEffect(() => {
    if (inView) ensurePostLoaded(p).catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView])

  const img0 = p.data?.images?.[0]
  const src = img0 ? (img0.path ? assetURL(p.channel.path, p.entry.path, img0.path) : img0.url) : undefined

  // Pick up to two authors
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
          <div className="flex items-center justify-between text-xs text-gray-500">
            <ChannelBadge ch={p.channel} />
            <span title={formatDate(p.entry.timestamp)}>{timeAgo(p.entry.timestamp)}</span>
          </div>
          {(p.entry.tags && p.entry.tags.length) ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {p.entry.tags.slice(0, 3).map(name => <span key={name} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] dark:bg-gray-800">{name}</span>)}
              {p.entry.tags.length > 3 && <span className="text-[10px] text-gray-500">+{p.entry.tags.length - 3}</span>}
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

type SortKey = "newest" | "oldest" | "az"

export default function App() {
  const [owner, setOwner] = useState(DEFAULT_OWNER)
  const [repo, setRepo] = useState(DEFAULT_REPO)
  const [branch, setBranch] = useState(DEFAULT_BRANCH)

  const { channels, entries, posts, loading, error, ensurePostLoaded } = useArchive(owner, repo, branch)

  // UI state
  const [q, setQ] = useState("")
  const [tagMode, setTagMode] = useState<'OR' | 'AND'>('AND')
  const [tagState, setTagState] = useState<Record<string, -1 | 0 | 1>>({})
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>("newest")
  const [active, setActive] = useState<IndexedPost | null>(null)
  const [lightbox, setLightbox] = useState<Image | null>(null)

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
    return names.map(n => ({ id: n, name: n })) as Tag[]
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
      if (sortKey === "newest") return b.entry.timestamp - a.entry.timestamp
      if (sortKey === "oldest") return a.entry.timestamp - b.entry.timestamp
      return a.entry.name.localeCompare(b.entry.name)
    })
    return list
  }, [posts, q, includeTags, excludeTags, selectedChannels, sortKey, tagMode])

  // --------- URL helpers for sharable links ---------
  function buildPostURL(p: IndexedPost) {
    const url = new URL(window.location.href)
    url.searchParams.set('id', p.entry.id)
    return url.pathname + '?' + url.searchParams.toString()
  }
  function clearPostURL(replace = false) {
    const url = new URL(window.location.href)
    url.searchParams.delete('id')
    const next = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '')
    if (replace) window.history.replaceState({}, '', next); else window.history.pushState({}, '', next)
  }
  function pushPostURL(p: IndexedPost, replace = false) {
    const next = buildPostURL(p)
    const state = { postId: p.entry.id }
    if (replace) window.history.replaceState(state, '', next); else window.history.pushState(state, '', next)
  }
  function getPostFromURL(): IndexedPost | undefined {
    const sp = new URLSearchParams(window.location.search)
    const id = sp.get('id');
    return posts.find(p => (id && p.entry.id === id))
  }

  // Open modal and update URL
  async function openCard(p: IndexedPost, replace = false) {
    const loaded = await ensurePostLoaded(p)
    setActive(loaded)
    pushPostURL(loaded, replace)
    // kick off lazy comments fetch without blocking the modal
    ensureCommentsLoaded(loaded).catch(() => { })
  }
  function closeModal(pushHistory = true) {
    setActive(null)
    if (pushHistory) clearPostURL()
  }

  // Handle initial URL and back/forward navigation
  useEffect(() => {
    const maybeOpenFromURL = async () => {
      const target = getPostFromURL()
      if (target) { await openCard(target, true) }
    }
    // If posts already loaded, try immediately; otherwise will also run when posts changes
    if (posts.length) { maybeOpenFromURL() }
    const onPop = () => {
      const target = getPostFromURL()
      if (target) openCard(target, true).catch(() => { })
      else setActive(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // We want to rerun when the set of posts changes or after initial load
  }, [posts])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">

            <img src={logoimg} alt="Logo" className="h-10 w-10" />

            <div>
              <div className="text-xl font-bold">Storage Tech 2</div>
              <div className="text-xs text-gray-500"><a href="https://github.com/Storage-Tech-2/Archive">{owner}/{repo}@{branch}</a></div>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-96">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search posts, codes, tags, authors" className="w-full rounded-xl border px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900" />
              <span className="pointer-events-none absolute left-3 top-2.5 text-gray-400">🔎</span>
            </div>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="rounded-xl border px-3 py-2 bg-white dark:bg-gray-900">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="az">A to Z</option>
            </select>
            <a href="https://discord.gg/hztJMTsx2m" target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
              Join Discord
            </a>
          </div>
        </div>
      </header>

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
                  <span className={selectedChannels.includes(ch.code) ? "text-white" : "text-gray-500"}>{ch.name}</span>
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
            {allTags.slice(0, 40).map(tag => (
              <TagChip key={tag.id} tag={tag} state={tagState[tag.name] || 0} count={tagCounts[normalize(tag.name)] || 0} onToggle={() => toggleTag(tag.name)} />
            ))}
            {allTags.length > 40 && <span className="text-xs text-gray-500">+{allTags.length - 40} more available</span>}
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
            <PostCard key={`${p.channel.path}/${p.entry.path}`} p={p} onOpen={openCard} ensurePostLoaded={ensurePostLoaded} />
          ))}
        </div>
      </main>

      {/* Details modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4" onClick={() => closeModal()}>
          <article className="max-w-3xl w-full rounded-2xl border bg-white p-0 shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <h3 className="text-lg font-bold">{active.entry.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <ChannelBadge ch={active.channel} />
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-gray-800">{active.entry.code}</span>
                  <span>{formatDate(active.entry.timestamp)}</span>
                </div>
              </div>
              <button onClick={() => closeModal()} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Close</button>
            </header>
            <div className="p-4">
              {active.data ? (
                <div className="flex flex-col gap-6">
                  {/* authors */}
                  <AuthorsLine authors={active.data.authors || []} />
                  <EndorsersLine endorsers={active.data.endorsers || []} />

                  {/* images */}
                  {active.data.images?.length ? (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {active.data.images.map((img) => (
                        <ImageThumb key={img.id} img={{ ...img, path: img.path ? assetURL(active.channel.path, active.entry.path, img.path) : img.path }} onClick={() => setLightbox({ ...img, path: img.path ? assetURL(active.channel.path, active.entry.path, img.path) : img.path })} />
                      ))}
                    </div>
                  ) : null}

                  {/* records */}
                  {active.data.records ? <RecordRenderer records={active.data.records} /> : null}

                  {/* acknowledgements */}
                  {(() => {
                    const list = (active.data.authors || []).filter(a => typeof a.reason === 'string' && a.reason.trim().length > 0)
                    if (!list.length) return null
                    return (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Acknowledgements</h4>
                        <ul className="ml-5 list-disc space-y-1 text-sm">
                          {list.map((a, i) => (
                            <li key={i}>
                              <span className="font-medium">{a.displayName || a.username || (a.type === AuthorType.DiscordDeleted ? 'Deleted' : 'Unknown')}</span>: <span className="text-gray-700 dark:text-gray-300">{a.reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })()}

                  {/* attachments */}
                  {active.data.attachments?.length ? (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Attachments</h4>
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
                              } /></div>}
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
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading post...</div>
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
              <button onClick={() => setLightbox(null)} className="rounded-full border border-white/40 px-3 py-1">Close</button>
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

