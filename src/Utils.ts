
// ------------------------------
// Utils

import type { IndexedPost } from "./App"
import { DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH } from "./Constants"
import { AuthorType, type Author } from "./Schema"

// ------------------------------
export function clsx(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(" ")
}

export function formatDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

export function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const sec = Math.round(diff / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  if (sec < 60) return `${sec}s ago`
  if (min < 60) return `${min}m ago`
  if (hr < 48) return `${hr}h ago`
  return `${day}d ago`
}

export function normalize(s?: string) {
  return (s || "").toLowerCase()
}

export function unique<T>(xs: T[]) { return Array.from(new Set(xs)) }

export function getAuthorName(a: Author) {
  return a.displayName || a.username || a.reason || (a.type === AuthorType.DiscordDeleted ? "Deleted" : "Unknown")
}

// Collect normalized tag names for a post from entry ref and loaded data
export function getPostTagsNormalized(p: IndexedPost): string[] {
  const entryTags = p.entry?.tags || []
  const loadedTags = p.data?.tags?.map(t => t.name) || []
  return unique([...entryTags, ...loadedTags]).map(normalize)
}

// Build a RAW GitHub URL for a repo path
function getRawURL(owner: string, repo: string, branch: string, path: string) {
  const safe = encodeURI(path.replace(/^\/+/, ""))
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${safe}`
}

// Safe path join for channel, entry, and relative asset paths
export function assetURL(
  channelPath: string,
  entryPath: string,
  rel: string,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
) {
  // Normalize each segment, collapse duplicate slashes, then remove any leading slash
  const joined = [channelPath, entryPath, rel]
    .join("/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
  return getRawURL(owner, repo, branch, joined)
}

// Derive a YouTube embed URL from common forms (watch, youtu.be, shorts, embed)
export function getYouTubeEmbedURL(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')
    let id: string | null = null
    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0] || null
    } else if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v')
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || null
      else if (u.pathname.startsWith('/embed/')) return raw
    }
    if (!id) return null
    const start = u.searchParams.get('t') || u.searchParams.get('start')
    const qs = start ? `?start=${encodeURIComponent(start)}&rel=0` : '?rel=0'
    return `https://www.youtube.com/embed/${id}${qs}`
  } catch {
    return null
  }
}

export async function fetchJSONRaw(path: string, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
  const url = getRawURL(owner, repo, branch, path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json()
}

// Simple pool to limit concurrent fetches
export async function asyncPool<T, R>(limit: number, items: T[], fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  const workers: Promise<void>[] = []
  async function work() {
    while (i < items.length) {
      const cur = i++
      results[cur] = await fn(items[cur], cur)
    }
  }
  for (let k = 0; k < Math.max(1, Math.min(limit, items.length)); k++) workers.push(work())
  await Promise.allSettled(workers)
  return results
}
