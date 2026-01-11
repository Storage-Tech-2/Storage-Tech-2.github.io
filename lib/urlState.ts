import { extractFiltersFromSearch, serializeListParam } from "./filtering";
import { type SortKey } from "./types";

type ArchiveFilters = {
  q: string;
  committedQ: string;
  tagMode: "OR" | "AND";
  tagState: Record<string, -1 | 0 | 1>;
  selectedChannels: string[];
  selectedAuthors: string[];
  sortKey: SortKey;
};

type DictionaryState = {
  query: string;
  committedQuery: string;
  sort: "az" | "updated";
  slug: string | null;
};

const ARCHIVE_SORTS: SortKey[] = ["newest", "oldest", "archived", "archivedOldest", "az"];

export function getArchiveFiltersFromUrl(): ArchiveFilters {
  if (typeof window === "undefined") {
    return {
      q: "",
      committedQ: "",
      tagMode: "AND",
      tagState: {},
      selectedChannels: [],
      selectedAuthors: [],
      sortKey: "newest",
    };
  }
  const sp = new URLSearchParams(window.location.search);
  const parsed = extractFiltersFromSearch(sp, ARCHIVE_SORTS);
  const q = parsed.q || "";
  return {
    q,
    committedQ: q,
    tagMode: parsed.tagMode,
    tagState: parsed.tagState || {},
    selectedChannels: parsed.selectedChannels || [],
    selectedAuthors: parsed.selectedAuthors || [],
    sortKey: parsed.sortKey || "newest",
  };
}

export function setArchiveFiltersToUrl(filters: ArchiveFilters) {
  if (typeof window === "undefined") return;
  const include = Object.keys(filters.tagState).filter((k) => filters.tagState[k] === 1);
  const exclude = Object.keys(filters.tagState).filter((k) => filters.tagState[k] === -1);
  const sp = new URLSearchParams();
  if (filters.committedQ.trim()) sp.set("q", filters.committedQ.trim());
  if (filters.sortKey !== "newest") sp.set("sort", filters.sortKey);
  if (filters.tagMode === "OR") sp.set("tagMode", "OR");
  if (include.length) sp.set("tags", serializeListParam(include));
  if (exclude.length) sp.set("xtags", serializeListParam(exclude));
  if (filters.selectedChannels.length) sp.set("channels", serializeListParam(filters.selectedChannels));
  if (filters.selectedAuthors.length) sp.set("authors", serializeListParam(filters.selectedAuthors));
  const query = sp.toString();
  const next = query ? `/?${query}` : "/";
  window.history.replaceState(window.history.state, "", next);
}

export function getDictionaryStateFromUrl(pathname?: string | null): DictionaryState {
  if (typeof window === "undefined") {
    return { query: "", committedQuery: "", sort: "az", slug: null };
  }
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("q") || "";
  const sortParam = sp.get("sort");
  const sort = sortParam === "updated" ? "updated" : "az";
  const match = pathname ? pathname.match(/^\/dictionary\/(.+)$/) : null;
  const slug = match ? decodeURIComponent(match[1].replace(/\/+$/, "")) : null;
  return { query: q, committedQuery: q, sort, slug };
}

export function setDictionaryStateToUrl(state: DictionaryState) {
  if (typeof window === "undefined") return;
  const sp = new URLSearchParams();
  if (state.committedQuery.trim()) sp.set("q", state.committedQuery.trim());
  if (state.sort !== "az") sp.set("sort", state.sort);
  const queryString = sp.toString();
  const path = state.slug ? `/dictionary/${encodeURIComponent(state.slug)}` : "/dictionary";
  const next = queryString ? `${path}?${queryString}` : path;
  window.history.replaceState(window.history.state, "", next);
}

export function readArchiveSession(): ArchiveFilters | null {
  if (typeof window === "undefined") return null;
  const nav = performance?.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "reload") return null;
  const saved = sessionStorage.getItem("archive-filters");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as ArchiveFilters;
  } catch {
    return null;
  } finally {
    sessionStorage.removeItem("archive-filters");
  }
}

export function writeArchiveSession(filters: ArchiveFilters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("archive-filters", JSON.stringify(filters));
}

export function readDictionarySession(): DictionaryState | null {
  if (typeof window === "undefined") return null;
  const nav = performance?.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "reload") return null;
  const saved = sessionStorage.getItem("dictionary-state");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as DictionaryState;
  } catch {
    return null;
  } finally {
    sessionStorage.removeItem("dictionary-state");
  }
}

export function writeDictionarySession(state: DictionaryState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("dictionary-state", JSON.stringify(state));
}
