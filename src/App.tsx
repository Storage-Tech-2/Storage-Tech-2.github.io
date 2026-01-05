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
import { normalize, unique } from "./utils";
import { getSpecialTagMeta, sortTagObjectsForDisplay } from "./utils/tagDisplay";
import {
  computeChannelCounts,
  computeTagCounts,
  extractFiltersFromSearch,
  filterDictionaryEntries,
  filterPosts,
  serializeListParam,
} from "./utils/filtering";
import {
  applyUrlState,
  clearDictionaryURL,
  clearPostURL,
  getDictionaryFromURL as getDictionaryFromURLFromList,
  getPostFromURL as getPostFromURLFromList,
  handleInternalNavigation,
  type NavigationState,
  pushArchiveViewState,
  pushDictionaryURL,
  pushDictionaryViewState,
  pushPostURL,
} from "./utils/urlNavigation";

// ------------------------------
// Main app component
// ------------------------------

const SORT_KEYS: SortKey[] = ["newest", "oldest", "archived", "archivedOldest", "az"]

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
  const [qCommitted, setQCommitted] = useState("")
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
  const [dictionarySort, setDictionarySort] = useState<"az" | "updated">("az")
  const [dictionaryDefinitions, setDictionaryDefinitions] = useState<Record<string, string>>({})
  const dictionaryFetchInFlight = useRef<Set<string>>(new Set())
  const lastArchiveFilterSignature = useRef<string>("")

  const applyFiltersFromSearch = useCallback((sp: URLSearchParams) => {
    const next = extractFiltersFromSearch(sp, SORT_KEYS)
    setQ(next.q)
    setQCommitted(next.q)
    if (next.sortKey) setSortKey(next.sortKey)
    setTagMode(next.tagMode)
    setTagState(next.tagState)
    setSelectedChannels(next.selectedChannels)
    setFiltersHydrated(true)
  }, [])

  // Commit the current search term to the URL when the user finishes typing
  const commitSearch = useCallback(() => {
    setQCommitted(q)
  }, [q])

  // Comments cache keyed by `${channel.path}/${entry.path}`
  const [commentsByKey, setCommentsByKey] = useState<Record<string, ArchiveComment[] | null>>({})
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({})
  const commentsKey = (p: IndexedPost) => `${p.channel.path}/${p.entry.path}`
  const ensureCommentsLoaded = useCallback(async (p: IndexedPost) => {
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
  }, [commentsByKey])

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

  const resetFilters = useCallback(() => {
    setSelectedChannels([])
    setTagState({})
    setTagMode("AND")
  }, [])

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
    let list = sortTagObjectsForDisplay(names.map(n => ({ id: n, name: n })) as Tag[])
    if (!selectedChannels.length) {
      list = list.filter(tag => !!getSpecialTagMeta(tag.name))
    }
    return list
  }, [channels, posts, selectedChannels])

  // Counts for channels: apply search and tag filters, ignore current channel selection
  const channelCounts = useMemo(() => computeChannelCounts(posts, includeTags, excludeTags, tagMode, q), [posts, includeTags, excludeTags, tagMode, q])

  // Counts for tags: apply search, channel filter, and exclude tags. Do not apply include-tags to preview potential additions.
  const tagCounts = useMemo(() => computeTagCounts(posts, selectedChannels, excludeTags, q), [posts, selectedChannels, excludeTags, q])

  // Build a filtered list
  const filtered = useMemo(
    () => filterPosts(posts, { q, includeTags, excludeTags, selectedChannels, sortKey, tagMode }),
    [posts, q, includeTags, excludeTags, selectedChannels, sortKey, tagMode],
  )

  const archiveFilterSignature = useMemo(() => {
    const sortedTagState = Object.keys(tagState).sort().reduce((acc, key) => {
      acc[key] = tagState[key]
      return acc
    }, {} as Record<string, -1 | 0 | 1>)
    return JSON.stringify({
      q,
      tagMode,
      tagState: sortedTagState,
      selectedChannels: [...selectedChannels].sort(),
      sortKey,
    })
  }, [q, tagMode, tagState, selectedChannels, sortKey])

  const filteredDictionary = useMemo(
    () => filterDictionaryEntries(dictionaryEntries, dictionaryQuery, dictionarySort),
    [dictionaryEntries, dictionaryQuery, dictionarySort],
  )

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

  const getPostFromURL = useCallback(
    (idOverride?: string): IndexedPost | undefined => getPostFromURLFromList(postsRef.current, idOverride),
    [],
  )
  const getDictionaryFromURL = useCallback(
    (didOverride?: string): IndexedDictionaryEntry | undefined => getDictionaryFromURLFromList(dictionaryEntriesRef.current, didOverride),
    [],
  )

  const switchToArchiveView = (replace = false) => {
    setView('archive')
    setActiveDictionary(null)
    pushArchiveViewState(replace, sortKey)
  }

  const switchToDictionaryView = (replace = false) => {
    setView('dictionary')
    setActive(null)
    pushDictionaryViewState(replace, dictionarySort)
  }

  // Open modal and update URL
  const openCard = useCallback(async (p: IndexedPost, replace = false, keepView = false) => {
    const loaded = await ensurePostLoaded(p)
    if (!keepView) setView('archive')
    setActiveDictionary(null)
    setActive(loaded)
    pushPostURL(loaded, replace, { keepView })
    // kick off lazy comments fetch without blocking the modal
    ensureCommentsLoaded(loaded).catch(() => { })
  }, [ensureCommentsLoaded, ensurePostLoaded])
  function closeModal(pushHistory = true) {
    setActive(null)
    if (pushHistory) clearPostURL(false, view === 'dictionary')
  }

  const openDictionaryEntry = useCallback(async (entry: IndexedDictionaryEntry, replace = false, keepView = false, updateURL = true) => {
    // show modal immediately to avoid flicker while data loads
    setActiveDictionary(entry)
    if (!keepView) setView('dictionary')
    setActive(null)
    const loaded = await ensureDictionaryEntryLoaded(entry)
    setActiveDictionary(loaded)
    if (updateURL) pushDictionaryURL(loaded, replace, dictionarySort)
  }, [ensureDictionaryEntryLoaded, dictionarySort])
  function closeDictionaryModal(pushHistory = true) {
    setActiveDictionary(null)
    if (pushHistory) clearDictionaryURL(false, view === 'dictionary')
  }

  const handleInternalLink = useCallback((url: URL) => handleInternalNavigation({
    url,
    view,
    posts,
    getDictionaryFromURL,
    openDictionaryEntry,
    openCard,
  }), [view, posts, getDictionaryFromURL, openDictionaryEntry, openCard])

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
    const onPop = (evt: PopStateEvent) => {
      const navState = (evt.state ?? window.history.state ?? null) as NavigationState | null
      applyUrlState({
        replace: true,
        navState,
        applyFiltersFromSearch,
        getDictionaryFromURL,
        getPostFromURL,
        openCard,
        openDictionaryEntry,
        setActive,
        setActiveDictionary,
        setView,
      }).catch(() => { })
    }
    const sp = new URLSearchParams(window.location.search)
    const navState = (window.history.state || null) as NavigationState | null
    const wantsPost = !!(navState?.postId ?? sp.get('id'))
    const wantsDictionary = !!(navState?.did ?? sp.get('did')) || navState?.view === 'dictionary' || sp.get('view') === 'dictionary'
    const dataReady = (!wantsPost || postsRef.current.length > 0) && (!wantsDictionary || dictionaryEntriesRef.current.length > 0)
    if (!urlStateApplied.current && dataReady) {
      urlStateApplied.current = true
      applyUrlState({
        replace: true,
        navState,
        applyFiltersFromSearch,
        getDictionaryFromURL,
        getPostFromURL,
        openCard,
        openDictionaryEntry,
        setActive,
        setActiveDictionary,
        setView,
      }).catch(() => { })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // We want to rerun when the set of posts changes or after initial load
  }, [posts.length, dictionaryEntries.length, applyFiltersFromSearch, openCard, openDictionaryEntry, getDictionaryFromURL, getPostFromURL])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    applyFiltersFromSearch(sp)
  }, [owner, repo, branch, applyFiltersFromSearch])

  useEffect(() => {
    if (view !== 'archive') return
    if (!lastArchiveFilterSignature.current) {
      lastArchiveFilterSignature.current = archiveFilterSignature
      return
    }
    if (lastArchiveFilterSignature.current !== archiveFilterSignature) {
      lastArchiveFilterSignature.current = archiveFilterSignature
      window.scrollTo({ top: 0, behavior: "instant" })
    }
  }, [archiveFilterSignature, view])

  useEffect(() => {
    if (!filtersHydrated) return
    const sp = new URLSearchParams(window.location.search)
    if (view === 'dictionary') {
      const sortParam = sp.get("dsort") === "updated" ? "updated" : "az"
      setDictionarySort(sortParam)
    } else {
      const sortParam = sp.get("sort") as SortKey | null
      if (sortParam && SORT_KEYS.includes(sortParam)) setSortKey(sortParam)
    }
  }, [view, filtersHydrated])
 
  useEffect(() => {
    const url = new URL(window.location.href)
    const sp = url.searchParams
    if (!filtersHydrated) return

    if (qCommitted.trim()) {
      sp.set("q", qCommitted)
    } else {
      sp.delete("q")
    }

    if (view === 'archive') {
      sp.set("sort", sortKey)
      sp.delete("dsort")
    } else {
      sp.set("dsort", dictionarySort)
      sp.delete("sort")
    }

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
    window.history.replaceState(window.history.state ?? {}, "", next)
  }, [qCommitted, sortKey, dictionarySort, tagMode, tagState, selectedChannels, filtersHydrated, view])

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
        onSearchCommit={commitSearch}
        sortKey={sortKey}
        onSortChange={(val) => setSortKey(val)}
        dictionaryQuery={dictionaryQuery}
        onDictionarySearchChange={setDictionaryQuery}
        dictionarySort={dictionarySort}
        onDictionarySortChange={setDictionarySort}
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
          resetFilters={resetFilters}
        />
      ) : (
        <DictionarySection
          dictionaryError={dictionaryError}
          dictionaryLoading={dictionaryLoading}
          filteredDictionary={filteredDictionary}
          dictionaryEntries={dictionaryEntries}
          dictionarySort={dictionarySort}
          openDictionaryEntry={openDictionaryEntry}
        />
      )}

      {/* Details modal */}
      {active && (
        <PostModal
          active={active}
          onClose={() => closeModal(true)}
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
        Built for the Storage Tech 2 archive. See the code at <a href="https://github.com/Storage-Tech-2/Storage-Tech-2.github.io" className="underline">github.com/Storage-Tech-2/Storage-Tech-2.github.io</a>.
      </footer>
    </div>
  )
}
