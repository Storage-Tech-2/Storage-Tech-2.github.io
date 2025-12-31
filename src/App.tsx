/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Image, type ArchiveComment, type StyleInfo, type Reference, ReferenceType, type ArchivedPostReference, type Tag } from "./types";
import { DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, getEntryArchivedAt, getEntryUpdatedAt, type IndexedDictionaryEntry, type IndexedPost, type SortKey } from "./types";
import logoimg from "./assets/logo.png";
import { useArchive, loadCommentsData } from "./hooks/useArchiveData";
import { useDictionary } from "./hooks/useDictionaryData";
import { HeaderBar } from "./components/HeaderBar";
import { ArchiveSection } from "./components/ArchiveSection";
import { DictionarySection } from "./components/DictionarySection";
import { PostModal } from "./components/PostModal";
import { DictionaryModal } from "./components/DictionaryModal";
import { normalize, unique, getPostTagsNormalized } from "./utils";
import { sortTagObjectsForDisplay } from "./utils/tagDisplay";

// ------------------------------
// Main app component
// ------------------------------

const SORT_KEYS: SortKey[] = ["newest", "oldest", "archived", "archivedOldest", "az"]
const parseListParam = (value: string | null) => value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []
const serializeListParam = (values: string[]) => values.filter(Boolean).join(",")

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
  const [filtersHydrated, setFiltersHydrated] = useState(false)
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

  const applyFiltersFromSearch = useCallback((sp: URLSearchParams) => {
    const nextQ = sp.get("q") ?? ""
    setQ(nextQ)

    const sortParam = sp.get("sort") as SortKey | null
    if (sortParam && SORT_KEYS.includes(sortParam)) setSortKey(sortParam)

    const modeParam = sp.get("tagMode")
    setTagMode(modeParam === "OR" ? "OR" : "AND")

    const includeTagsRaw = parseListParam(sp.get("tags"))
    const excludeTagsRaw = parseListParam(sp.get("xtags"))
    setTagState(() => {
      const next: Record<string, -1 | 0 | 1> = {}
      includeTagsRaw.forEach((name) => { next[name] = 1 })
      excludeTagsRaw.forEach((name) => { next[name] = -1 })
      return next
    })

    const channelsParam = parseListParam(sp.get("channels"))
    setSelectedChannels(channelsParam)
    setFiltersHydrated(true)
  }, [])

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

  const toggleChannel = useCallback((code: string) => {
    setSelectedChannels(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code])
  }, [])

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
  useEffect(() => { urlStateApplied.current = false; setFiltersHydrated(false) }, [owner, repo, branch])

  useEffect(() => {
    const applyURLState = async (replace = false, navState?: NavigationState | null) => {
      const sp = new URLSearchParams(window.location.search)
      applyFiltersFromSearch(sp)
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
  }, [posts.length, dictionaryEntries.length, applyFiltersFromSearch])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    applyFiltersFromSearch(sp)
  }, [owner, repo, branch, applyFiltersFromSearch])
 
  useEffect(() => {
    const url = new URL(window.location.href)
    const sp = url.searchParams
    if (!filtersHydrated) return

    if (q.trim()) {
      sp.set("q", q)
    } else {
      sp.delete("q")
    }


    sp.set("sort", sortKey)

    if (tagMode === 'OR') {
      sp.set("tagMode", tagMode)
    } else {
      sp.delete("tagMode")
    }

    const includeTagsRaw = Object.entries(tagState).filter(([, v]) => v === 1).map(([k]) => k).sort()
    const excludeTagsRaw = Object.entries(tagState).filter(([, v]) => v === -1).map(([k]) => k).sort()
    const includeSerialized = serializeListParam(includeTagsRaw)
    const excludeSerialized = serializeListParam(excludeTagsRaw)
    if (includeSerialized) {
      sp.set("tags", includeSerialized)
    } else {
      sp.delete("tags")
    }
    if (excludeSerialized) {
      sp.set("xtags", excludeSerialized)
    } else {
      sp.delete("xtags")
    }

    const channelsSerialized = serializeListParam([...selectedChannels].sort())
    if (channelsSerialized) {
      sp.set("channels", channelsSerialized)
    } else {
      sp.delete("channels")
    }

    const nextSearch = sp.toString()
    const currentSearch = window.location.search.replace(/^\?/, "")
    if (nextSearch === currentSearch) return
    const next = url.pathname + (nextSearch ? `?${nextSearch}` : "")
    window.history.replaceState(window.history.state, "", next)
  }, [q, sortKey, tagMode, tagState, selectedChannels, filtersHydrated])

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
      <HeaderBar
        owner={owner}
        repo={repo}
        branch={branch}
        view={view}
        logoSrc={logoimg}
        q={q}
        onSearchChange={setQ}
        sortKey={sortKey}
        onSortChange={(val) => setSortKey(val)}
        dictionaryQuery={dictionaryQuery}
        onDictionarySearchChange={setDictionaryQuery}
        onArchiveClick={() => switchToArchiveView()}
        onDictionaryClick={() => switchToDictionaryView()}
      />

      {view === 'archive' ? (
        <ArchiveSection
          channels={channels}
          selectedChannels={selectedChannels}
          channelCounts={channelCounts}
          toggleChannel={toggleChannel}
          tagMode={tagMode}
          setTagMode={setTagMode}
          allTags={allTags}
          tagState={tagState}
          toggleTag={toggleTag}
          tagCounts={tagCounts}
          error={error}
          loading={loading}
          filtered={filtered}
          posts={posts}
          openCard={openCard}
          ensurePostLoaded={ensurePostLoaded}
          sortKey={sortKey}
        />
      ) : (
        <DictionarySection
          dictionaryError={dictionaryError}
          dictionaryLoading={dictionaryLoading}
          filteredDictionary={filteredDictionary}
          dictionaryEntries={dictionaryEntries}
          openDictionaryEntry={openDictionaryEntry}
        />
      )}

      {/* Details modal */}
      {view === 'archive' && active && (
        <PostModal
          active={active}
          onClose={() => closeModal()}
          activeUpdatedAt={activeUpdatedAt}
          activeArchivedAt={activeArchivedAt}
          dictionaryTooltips={dictionaryTooltips}
          postTooltipLookup={postTooltipLookup}
          commentsByKey={commentsByKey}
          commentsLoading={commentsLoading}
          setLightbox={setLightbox}
          handleInternalLink={handleInternalLink}
          schemaStyles={schemaStyles}
        />
      )}

      {activeDictionary && (
        <DictionaryModal
          activeDictionary={activeDictionary}
          onClose={() => closeDictionaryModal()}
          dictionaryTooltips={dictionaryTooltips}
          postTooltipLookup={postTooltipLookup}
          handleInternalLink={handleInternalLink}
          dictionaryReferencedBy={dictionaryReferencedBy}
          openCard={openCard}
        />
      )}

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
