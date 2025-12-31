import { getEntryArchivedAt, getEntryUpdatedAt, type IndexedDictionaryEntry, type IndexedPost, type SortKey } from "../types";
import { getPostTagsNormalized } from "./tags";

export type TagMode = "OR" | "AND";

export const parseListParam = (value: string | null) => value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
export const serializeListParam = (values: string[]) => values.filter(Boolean).join(",");

export const buildTagState = (includeTagsRaw: string[], excludeTagsRaw: string[]) => {
  const next: Record<string, -1 | 0 | 1> = {};
  includeTagsRaw.forEach((name) => { next[name] = 1; });
  excludeTagsRaw.forEach((name) => { next[name] = -1; });
  return next;
};

export const extractFiltersFromSearch = (sp: URLSearchParams, sortKeys: SortKey[]) => {
  const q = sp.get("q") ?? "";
  const sortParam = sp.get("sort") as SortKey | null;
  const sortKey = sortParam && sortKeys.includes(sortParam) ? sortParam : undefined;
  const tagMode: TagMode = sp.get("tagMode") === "OR" ? "OR" : "AND";
  const includeTagsRaw = parseListParam(sp.get("tags"));
  const excludeTagsRaw = parseListParam(sp.get("xtags"));
  const tagState = buildTagState(includeTagsRaw, excludeTagsRaw);
  const selectedChannels = parseListParam(sp.get("channels"));
  return { q, sortKey, tagMode, tagState, selectedChannels };
};

export const computeChannelCounts = (
  posts: IndexedPost[],
  includeTags: string[],
  excludeTags: string[],
  tagMode: TagMode,
  q: string,
) => {
  const map: Record<string, number> = {};
  const trimmed = q.trim().toLowerCase();
  const list = posts.filter(p => {
    const postTags = getPostTagsNormalized(p);
    if (excludeTags.some(t => postTags.includes(t))) return false;
    if (includeTags.length) {
      if (tagMode === "OR" && !includeTags.some(t => postTags.includes(t))) return false;
      if (tagMode === "AND" && !includeTags.every(t => postTags.includes(t))) return false;
    }
    if (!trimmed) return true;
    const base = [p.entry.name, p.entry.code, p.channel.code, p.channel.name].join(" ").toLowerCase();
    const extra = [
      p.entry.tags?.join(" ") || "",
      ...(p.data ? [
        p.data.tags?.map(t => t.name).join(" ") || "",
        typeof p.data.records?.description === "string" ? p.data.records.description : "",
      ] : []),
    ].join(" ").toLowerCase();
    return `${base} ${extra}`.includes(trimmed);
  });
  list.forEach(p => { map[p.channel.code] = (map[p.channel.code] || 0) + 1; });
  return map;
};

export const computeTagCounts = (
  posts: IndexedPost[],
  selectedChannels: string[],
  excludeTags: string[],
  q: string,
) => {
  const map: Record<string, number> = {};
  const trimmed = q.trim().toLowerCase();
  const channelSet = selectedChannels.length ? new Set(selectedChannels) : null;
  const list = posts.filter(p => {
    if (channelSet && !(channelSet.has(p.channel.code) || channelSet.has(p.channel.name))) return false;
    const postTags = getPostTagsNormalized(p);
    if (excludeTags.some(t => postTags.includes(t))) return false;
    if (!trimmed) return true;
    const base = [p.entry.name, p.entry.code, p.channel.code, p.channel.name].join(" ").toLowerCase();
    const extra = [
      p.entry.tags?.join(" ") || "",
      ...(p.data ? [
        p.data.tags?.map(t => t.name).join(" ") || "",
        typeof p.data.records?.description === "string" ? p.data.records.description : "",
      ] : []),
    ].join(" ").toLowerCase();
    return `${base} ${extra}`.includes(trimmed);
  });
  list.forEach(p => {
    getPostTagsNormalized(p).forEach(t => { map[t] = (map[t] || 0) + 1; });
  });
  return map;
};

type FilterPostsParams = {
  q: string;
  includeTags: string[];
  excludeTags: string[];
  selectedChannels: string[];
  sortKey: SortKey;
  tagMode: TagMode;
};

export const filterPosts = (posts: IndexedPost[], params: FilterPostsParams) => {
  const { q, includeTags, excludeTags, selectedChannels, sortKey, tagMode } = params;
  const trimmed = q.trim();
  let list = posts;

  if (selectedChannels.length) {
    const set = new Set(selectedChannels);
    list = list.filter(p => set.has(p.channel.code) || set.has(p.channel.name));
  }

  if (includeTags.length || excludeTags.length) {
    list = list.filter(p => {
      const postTags = getPostTagsNormalized(p);
      if (excludeTags.some(t => postTags.includes(t))) return false;
      if (!includeTags.length) return true;
      if (tagMode === "OR") return includeTags.some(t => postTags.includes(t));
      return includeTags.every(t => postTags.includes(t));
    });
  }

  if (trimmed) {
    const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter(p => {
      const base = [p.entry.name, p.entry.code, p.channel.code, p.channel.name].join(" ").toLowerCase();
      const extra = [
        p.entry.tags?.join(" ") || "",
        ...(p.data ? [
          p.data.tags?.map(t => t.name).join(" ") || "",
          typeof p.data.records?.description === "string" ? p.data.records.description : "",
        ] : []),
      ].join(" ").toLowerCase();
      const hay = `${base} ${extra}`;
      return terms.every(t => hay.includes(t));
    });
  }

  return list.slice().sort((a, b) => {
    if (sortKey === "newest") return (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0);
    if (sortKey === "oldest") return (getEntryUpdatedAt(a.entry) ?? 0) - (getEntryUpdatedAt(b.entry) ?? 0);
    if (sortKey === "archived") return (getEntryArchivedAt(b.entry) ?? 0) - (getEntryArchivedAt(a.entry) ?? 0);
    if (sortKey === "archivedOldest") return (getEntryArchivedAt(a.entry) ?? 0) - (getEntryArchivedAt(b.entry) ?? 0);
    return a.entry.name.localeCompare(b.entry.name);
  });
};

export const filterDictionaryEntries = (dictionaryEntries: IndexedDictionaryEntry[], dictionaryQuery: string) => {
  const term = dictionaryQuery.trim().toLowerCase();
  if (!term) return dictionaryEntries;
  return dictionaryEntries.filter(entry => {
    const haystack = [
      entry.index.summary || "",
      ...(entry.index.terms || []),
      entry.data?.definition || "",
    ].join(" ").toLowerCase();
    return haystack.includes(term);
  });
};
