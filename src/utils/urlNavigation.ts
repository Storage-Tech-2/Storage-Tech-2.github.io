import { type Dispatch, type SetStateAction } from "react";
import { type IndexedDictionaryEntry, type IndexedPost, type SortKey } from "../types";

export type NavigationState = {
  postId?: string;
  did?: string;
  view?: "archive" | "dictionary";
  keepView?: boolean;
  keepDictionaryViewForPost?: boolean;
};

export const buildPostURL = (p: IndexedPost, opts?: { keepView?: boolean }) => {
  const url = new URL(window.location.href);
  url.searchParams.set("id", p.entry.id);
  url.searchParams.delete("did");
  if (!opts?.keepView) {
    url.searchParams.delete("view");
  } else if (!url.searchParams.get("view")) {
    url.searchParams.set("view", "dictionary");
  }
  return url.pathname + "?" + url.searchParams.toString();
};

export const clearPostURL = (replace = false, preserveDictionary = false) => {
  const url = new URL(window.location.href);
  url.searchParams.delete("id");
  url.searchParams.delete("did");
  if (!preserveDictionary) {
    url.searchParams.delete("view");
  }
  const next = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "");
  if (replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
};

export const pushPostURL = (p: IndexedPost, replace = false, opts?: { keepView?: boolean }) => {
  const next = buildPostURL(p, opts);
  const state: NavigationState = { postId: p.entry.id };
  if (opts?.keepView) {
    state.view = "dictionary";
    state.keepDictionaryViewForPost = true;
    const currentDid = new URL(window.location.href).searchParams.get("did");
    if (currentDid) state.did = currentDid;
  }
  if (replace) window.history.replaceState(state, "", next);
  else window.history.pushState(state, "", next);
};

export const getPostFromURL = (posts: IndexedPost[], idOverride?: string): IndexedPost | undefined => {
  const sp = new URLSearchParams(window.location.search);
  const id = idOverride ?? sp.get("id");
  return posts.find(p => (id && p.entry.id === id));
};

export const buildDictionaryURL = (entry: IndexedDictionaryEntry) => {
  const url = new URL(window.location.href);
  url.searchParams.set("did", entry.index.id);
  url.searchParams.set("view", "dictionary");
  url.searchParams.delete("id");
  return url.pathname + "?" + url.searchParams.toString();
};

export const clearDictionaryURL = (replace = false, keepDictionaryView = true) => {
  const url = new URL(window.location.href);
  url.searchParams.delete("did");
  if (keepDictionaryView) {
    url.searchParams.set("view", "dictionary");
  } else {
    url.searchParams.delete("view");
  }
  const nextSearch = url.searchParams.toString();
  const currentSearch = new URL(window.location.href).searchParams.toString();
  const next = url.pathname + (nextSearch ? "?" + nextSearch : "");
  if (nextSearch === currentSearch) return;
  if (replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
};

export const pushDictionaryURL = (entry: IndexedDictionaryEntry, replace = false, dictionarySort?: "az" | "updated") => {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("did", entry.index.id);
  nextUrl.searchParams.set("view", "dictionary");
  nextUrl.searchParams.delete("id");
  nextUrl.searchParams.delete("sort");
  if (dictionarySort) nextUrl.searchParams.set("dsort", dictionarySort);
  const next = nextUrl.pathname + (nextUrl.searchParams.toString() ? "?" + nextUrl.searchParams.toString() : "");
  const state = { did: entry.index.id, view: "dictionary" };
  if (replace) window.history.replaceState(state, "", next);
  else window.history.pushState(state, "", next);
};

export const getDictionaryFromURL = (dictionaryEntries: IndexedDictionaryEntry[], didOverride?: string): IndexedDictionaryEntry | undefined => {
  const sp = new URLSearchParams(window.location.search);
  const did = didOverride ?? sp.get("did");
  if (!did) return undefined;
  return dictionaryEntries.find(p => p.index.id === did) || {
    index: { id: did, terms: [did], summary: "", updatedAt: Date.now() },
  };
};

export const pushArchiveViewState = (replace = false, archiveSort?: SortKey) => {
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  url.searchParams.delete("did");
  url.searchParams.delete("dsort");
  if (archiveSort) url.searchParams.set("sort", archiveSort);
  const next = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "");
  const state: NavigationState = { view: "archive" };
  if (replace) window.history.replaceState(state, "", next);
  else window.history.pushState(state, "", next);
};

export const pushDictionaryViewState = (replace = false, dictionarySort?: "az" | "updated") => {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "dictionary");
  url.searchParams.delete("id");
  url.searchParams.delete("sort");
  if (dictionarySort) url.searchParams.set("dsort", dictionarySort);
  const next = url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "");
  const state: NavigationState = { view: "dictionary" };
  if (replace) window.history.replaceState(state, "", next);
  else window.history.pushState(state, "", next);
};

type HandleInternalNavigationArgs = {
  url: URL;
  view: "archive" | "dictionary";
  posts: IndexedPost[];
  getDictionaryFromURL: (did?: string) => IndexedDictionaryEntry | undefined;
  openDictionaryEntry: (entry: IndexedDictionaryEntry, replace?: boolean, keepView?: boolean, updateURL?: boolean) => void | Promise<void>;
  openCard: (post: IndexedPost, replace?: boolean, keepView?: boolean) => void | Promise<void>;
};

export const handleInternalNavigation = ({
  url,
  view,
  posts,
  getDictionaryFromURL,
  openDictionaryEntry,
  openCard,
}: HandleInternalNavigationArgs) => {
  if (url.origin !== window.location.origin) return false;
  const did = url.searchParams.get("did");
  if (did) {
    const keepView = view === "archive";
    const targetDict = getDictionaryFromURL(did);
    const state: NavigationState = { did, view: keepView ? "archive" : "dictionary", keepView };
    if (keepView) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("did", did);
      nextUrl.searchParams.delete("id");
      nextUrl.searchParams.delete("view");
      window.history.pushState(state, "", nextUrl.toString());
    } else {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("did", did);
      nextUrl.searchParams.set("view", "dictionary");
      nextUrl.searchParams.delete("id");
      window.history.pushState(state, "", nextUrl.toString());
    }
    if (targetDict) openDictionaryEntry(targetDict, false, keepView, false);
    return true;
  }
  const postId = url.searchParams.get("id");
  if (postId) {
    const targetPost = posts.find(p => p.entry.id === postId);
    if (targetPost) {
      openCard(targetPost, false, view === "dictionary");
      return true;
    }
    return false;
  }
  return false;
};

type ApplyUrlStateParams = {
  replace?: boolean;
  navState?: NavigationState | null;
  applyFiltersFromSearch: (sp: URLSearchParams) => void;
  getDictionaryFromURL: (did?: string) => IndexedDictionaryEntry | undefined;
  getPostFromURL: (id?: string) => IndexedPost | undefined;
  openCard: (p: IndexedPost, replace?: boolean, keepView?: boolean) => Promise<void>;
  openDictionaryEntry: (entry: IndexedDictionaryEntry, replace?: boolean, keepView?: boolean, updateURL?: boolean) => Promise<void>;
  setActive: Dispatch<SetStateAction<IndexedPost | null>>;
  setActiveDictionary: Dispatch<SetStateAction<IndexedDictionaryEntry | null>>;
  setView: Dispatch<SetStateAction<"archive" | "dictionary">>;
};

export const applyUrlState = async ({
  replace = false,
  navState,
  applyFiltersFromSearch,
  getDictionaryFromURL,
  getPostFromURL,
  openCard,
  openDictionaryEntry,
  setActive,
  setActiveDictionary,
  setView,
}: ApplyUrlStateParams) => {
  const sp = new URLSearchParams(window.location.search);
  applyFiltersFromSearch(sp);
  const postId = navState?.postId ?? sp.get("id") ?? undefined;
  const didParam = navState?.did ?? sp.get("did") ?? undefined;
  const keepView = navState?.keepView ?? false;
  const keepDictionaryViewForPost = navState?.keepDictionaryViewForPost ?? false;
  const viewParam = navState?.view ?? sp.get("view");
  const wantsDictionary = !!didParam || viewParam === "dictionary" || keepDictionaryViewForPost;
  const targetView = keepView ? "archive" : wantsDictionary ? "dictionary" : "archive";
  setView(targetView);
  if (targetView === "dictionary" && !keepView) {
    const targetDict = getDictionaryFromURL(didParam);
    if (targetDict) {
      await openDictionaryEntry(targetDict, replace, false, false);
    } else {
      setActiveDictionary(null);
    }
    if (postId) {
      const targetPost = getPostFromURL(postId);
      if (targetPost) {
        await openCard(targetPost, replace, true);
      } else {
        setActive(null);
      }
    } else {
      setActive(null);
    }
    return;
  }
  const targetPost = postId ? getPostFromURL(postId) : undefined;
  if (targetPost) {
    await openCard(targetPost, replace);
  } else {
    setActive(null);
  }
  if (didParam) {
    const targetDict = getDictionaryFromURL(didParam);
    if (targetDict) {
      await openDictionaryEntry(targetDict, replace, true, false);
    } else {
      setActiveDictionary(null);
    }
  } else {
    setActiveDictionary(null);
  }
};
