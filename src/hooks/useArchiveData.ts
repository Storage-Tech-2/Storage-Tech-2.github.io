import { useEffect, useRef, useState } from "react"
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO, USE_RAW, getEntryUpdatedAt, type ArchiveConfig, type ArchiveEntryData, type ChannelData, type ChannelRef, type EntryRef, type IndexedPost } from "../types"
import { asyncPool, fetchJSONRaw } from "../utils"

export async function loadConfig(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<ArchiveConfig> {
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

export async function loadPostData(channelPath: string, entry: EntryRef, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<ArchiveEntryData> {
  const path = `${channelPath}/${entry.path}/data.json`
  return USE_RAW ? fetchJSONRaw(path, owner, repo, branch) : (await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })).json()
}

export async function loadCommentsData(channelPath: string, entry: EntryRef, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
  const path = `${channelPath}/${entry.path}/comments.json`
  try {
    if (USE_RAW) return await fetchJSONRaw(path, owner, repo, branch)
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    return []
  }
}

export function useArchive(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
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
        const cfg = await loadConfig(owner, repo, branch)
        if (cancelled) return
        setConfig(cfg)
        setChannels(cfg.archiveChannels)
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
        const idx: IndexedPost[] = []
        channelDatas.forEach(({ channel, data }) => {
          data.entries.forEach((entry) => idx.push({ channel, entry }))
        })
        idx.sort((a, b) => (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0))
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

  const ensurePostLoaded = async (ip: IndexedPost) => {
    if (ip.data) return ip
    const key = `${ip.channel.path}/${ip.entry.path}`
    const existing = inflight.current.get(key)
    if (existing) return existing
    const p = (async () => {
      const data = await loadPostData(ip.channel.path, ip.entry, owner, repo, branch)
      ip.data = data
      setPosts((prev) => prev.map((p) => (p.entry.path === ip.entry.path && p.channel.path === ip.channel.path ? { ...p, data } : p)))
      return { ...ip, data }
    })()
    inflight.current.set(key, p)
    try { return await p } finally { inflight.current.delete(key) }
  }

  return { config, channels, entries, posts, loading, error, ensurePostLoaded }
}
