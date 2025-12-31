import { useEffect, useRef, useState } from "react"
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO, USE_RAW, type DictionaryConfig, type DictionaryEntry, type IndexedDictionaryEntry } from "../types"
import { fetchJSONRaw } from "../utils"

async function loadDictionaryConfig(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<DictionaryConfig> {
  const path = `dictionary/config.json`
  return USE_RAW ? fetchJSONRaw(path, owner, repo, branch) : (await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })).json()
}

async function loadDictionaryEntry(id: string, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH): Promise<DictionaryEntry> {
  const path = `dictionary/entries/${id}.json`
  return USE_RAW ? fetchJSONRaw(path, owner, repo, branch) : (await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Accept: "application/vnd.github.raw" } })).json()
}

export function useDictionary(owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
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
