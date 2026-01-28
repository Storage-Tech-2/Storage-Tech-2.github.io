import { fetchArrayBufferRaw, fetchJSONRaw, getLastFetchTimestampForPath } from "./github";
import {
  ArchiveComment,
  ArchiveConfig,
  ArchiveConfigJSON,
  ArchivedPostReference,
  ArchiveEntryData,
  ChannelRef,
  DictionaryConfig,
  DictionaryEntry,
  IndexEntry,
  IndexedDictionaryEntry,
  IndexedPost,
  DEFAULT_GLOBAL_TAGS,
  getEntryUpdatedAt,
} from "./types";
import { deserializePersistentIndex, type PersistentIndex } from "./utils/persistentIndex";

export type ArchiveListItem = IndexedPost & { slug: string };

export type ArchiveIndex = {
  config: ArchiveConfig;
  channels: ChannelRef[];
  posts: ArchiveListItem[];
};

export type DictionaryIndex = {
  config: DictionaryConfig;
  entries: IndexedDictionaryEntry[];
};

const archiveConfigCache = new Map<string, Promise<ArchiveConfigJSON | null>>();
export const ARCHIVE_CACHE_TTL_MS = 2 * 60 * 1000;

type ArchiveIndexCache = {
  index: ArchiveIndex;
  fetchedAt: number;
  updatedAt: number;
};

let archiveIndexClientCache: ArchiveIndexCache | null = null;
let archiveIndexPrefetchPromise: Promise<ArchiveIndex | null> | null = null;
let lastArchiveFetchAt = 0;

function getArchiveIndexUpdatedAt(index: ArchiveIndex): number {
  const configUpdated = index.config.updatedAt ?? 0;
  if (configUpdated) return configUpdated;
  let maxEntryUpdated = 0;
  for (const post of index.posts) {
    const ts = getEntryUpdatedAt(post.entry);
    if (typeof ts === "number" && ts > maxEntryUpdated) maxEntryUpdated = ts;
  }
  return maxEntryUpdated;
}

export function getCachedArchiveIndex(): ArchiveIndexCache | null {
  return archiveIndexClientCache;
}

export function setCachedArchiveIndex(index: ArchiveIndex, fetchedAt = Date.now()): ArchiveIndexCache {
  const cache: ArchiveIndexCache = {
    index,
    fetchedAt,
    updatedAt: getArchiveIndexUpdatedAt(index),
  };
  archiveIndexClientCache = cache;
  return cache;
}

export function getLastArchiveFetchAt() {
  return lastArchiveFetchAt;
}

export async function prefetchArchiveIndex(ttlMs = ARCHIVE_CACHE_TTL_MS): Promise<ArchiveIndex | null> {
  const cached = getCachedArchiveIndex();
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.index;
  if (archiveIndexPrefetchPromise) return archiveIndexPrefetchPromise;
  archiveIndexPrefetchPromise = (async () => {
    try {
      const idx = await fetchArchiveIndex();
      const fetchedAt = getLastArchiveFetchAt() || Date.now();
      setCachedArchiveIndex(idx, fetchedAt);
      return idx;
    } catch {
      return null;
    } finally {
      archiveIndexPrefetchPromise = null;
    }
  })();
  return archiveIndexPrefetchPromise;
}

async function fetchArchiveConfig(): Promise<ArchiveConfigJSON | null> {
  if (typeof window !== "undefined") return null;
  const key = "archive-config";
  const cached = archiveConfigCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    try {
      return await fetchJSONRaw<ArchiveConfigJSON>("config.json");
    } catch {
      return null;
    }
  })();
  archiveConfigCache.set(key, promise);
  return promise;
}

export function slugifyName(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildEntrySlug(entry: IndexEntry) {
  const base = entry.codes[0];
  const name = entry.name ? slugifyName(entry.name) : "";
  if (!base) return name;
  if (!name) return base;
  return `${base}-${name}`;
}

export function buildEntrySlugFromReference(entry: ArchivedPostReference) {
  const base = entry.code;
  const name = entry.name ? slugifyName(entry.name) : "";
  if (!base) return name;
  if (!name) return base;
  return `${base}-${name}`;
}

export function slugMatchesEntry(slug: string, entry: IndexEntry) {
  const lowerSlug = slug.toLowerCase();
  const entrySlug = buildEntrySlug(entry).toLowerCase();
  if (lowerSlug === entrySlug) return true;
  const slugCode = lowerSlug.split("-")[0];
  if (!slugCode) return false;
  return entry.codes.some((code) => code.toLowerCase() === slugCode);
}

function persistentIndexToArchive(idx: PersistentIndex, archiveConfig?: ArchiveConfigJSON | null): ArchiveIndex {
  const categories = idx.all_categories || [];
  const tags = idx.all_tags || [];
  const authors = idx.all_authors || [];

  const channels: ChannelRef[] = idx.channels.map((channel) => ({
    code: channel.code,
    name: channel.name,
    description: channel.description,
    category: categories[channel.category] || "",
    path: channel.path,
    availableTags: Array.from(new Set(channel.tags.map((tagIdx) => tags[tagIdx]).filter(Boolean))),
  }));

  const posts: ArchiveListItem[] = [];
  let maxEntryUpdatedAt = 0;
  idx.channels.forEach((channel, i) => {
    const channelRef = channels[i];
    channel.entries.forEach((entry) => {
      const codes = entry.codes;
      const entryRef: IndexEntry = {
        id: entry.id,
        name: entry.name,
        codes,
        tags: Array.from(new Set(entry.tags.map((tagIdx) => tags[tagIdx]).filter(Boolean))),
        authors: Array.from(new Set(entry.authors.map((authorIdx) => authors[authorIdx]).filter(Boolean))),
        updatedAt: entry.updated_at,
        archivedAt: entry.archived_at,
        path: entry.path,
        mainImagePath: entry.main_image_path
      };
      const entryUpdatedAt = getEntryUpdatedAt(entryRef) ?? 0;
      if (entryUpdatedAt > maxEntryUpdatedAt) maxEntryUpdatedAt = entryUpdatedAt;
      posts.push({ channel: channelRef, entry: entryRef, slug: buildEntrySlug(entryRef) });
    });
  });

  posts.sort((a, b) => (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0));

  const archiveUpdatedAt = Math.max(idx.updated_at ?? 0, maxEntryUpdatedAt);
  const config: ArchiveConfig = {
    postStyle: idx.schemaStyles || {},
    updatedAt: archiveUpdatedAt,
    allTags: tags,
    allAuthors: authors,
    allCategories: categories,
    globalTags: archiveConfig?.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS,
  };

  return { config, channels, posts };
}

export async function fetchArchiveIndex(): Promise<ArchiveIndex> {
  const archiveConfig = await fetchArchiveConfig();
  const cached = await readArchiveIndexCache();
  if (cached) return applyGlobalTagsToArchive(cached, archiveConfig);
  const buffer = await fetchArrayBufferRaw("persistent.idx");
  lastArchiveFetchAt = getLastFetchTimestampForPath("persistent.idx") || Date.now();
  const idx = deserializePersistentIndex(buffer);
  return persistentIndexToArchive(idx, archiveConfig);
}

export type PostWithArchive = {
  archive: ArchiveIndex;
  post: ArchiveListItem;
  data: ArchiveEntryData;
};

const archiveIndexCache = new Map<string, Promise<ArchiveIndex>>();
const postPayloadCache = new Map<string, Promise<ArchiveEntryData>>();

export async function fetchPostData(
  channelPath: string,
  entry: IndexEntry
): Promise<ArchiveEntryData> {
  const path = `${channelPath}/${entry.path}/data.json`;
  return fetchJSONRaw<ArchiveEntryData>(path);
}

export async function fetchPostWithArchive(
  slug: string
): Promise<PostWithArchive | null> {
  // first, fetch archive index
  const indexKey = "archive-index";
  const archivePromise =
    archiveIndexCache.get(indexKey) ??
    (async () => {
      const idx = await fetchArchiveIndex();
      archiveIndexCache.set(indexKey, Promise.resolve(idx));
      return idx;
    })();
  archiveIndexCache.set(indexKey, archivePromise);
  const archiveIndex = await archivePromise;


  // then, find post by slug
  const key = slug.toLowerCase();
  const match = findPostBySlug(archiveIndex.posts, slug);
  if (!match) return null;

  // check cache for post payload
  const cachedPayload = postPayloadCache.get(key);
  if (cachedPayload) {
    return {
      archive: archiveIndex,
      post: match,
      data: await cachedPayload,
    }
  }

  const promise = (async () => {
    const data = await fetchPostData(match.channel.path, match.entry);
    return data;
  })();

  postPayloadCache.set(key, promise);

  return {
    archive: archiveIndex,
    post: match,
    data: await promise,
  };
}

export async function fetchCommentsData(
  channelPath: string,
  entry: IndexEntry
): Promise<ArchiveComment[]> {
  const path = `${channelPath}/${entry.path}/comments.json`;
  try {
    return await fetchJSONRaw<ArchiveComment[]>(path);
  } catch {
    return [];
  }
}

export async function fetchDictionaryIndex(): Promise<DictionaryIndex> {
  const cached = await readDictionaryIndexCache();
  if (cached) return cached;
  const config = await fetchJSONRaw<DictionaryConfig>("dictionary/config.json");
  const entries: IndexedDictionaryEntry[] = config.entries
    .map((index) => ({ index }))
    .sort((a, b) => {
      const aTerm = (a.index.terms?.[0] || "").toLowerCase();
      const bTerm = (b.index.terms?.[0] || "").toLowerCase();
      if (aTerm && bTerm) return aTerm.localeCompare(bTerm);
      return aTerm ? -1 : bTerm ? 1 : 0;
    });
  return { config, entries };
}

async function readArchiveIndexCache(): Promise<ArchiveIndex | null> {
  if (typeof window !== "undefined") return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "lib", "generated", "archive-index.json");
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as ArchiveIndex;
    if (!parsed || !Array.isArray(parsed.posts)) return null;
    if (!parsed.config?.postStyle) return null;
    if (!Array.isArray(parsed.config.allAuthors)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applyGlobalTagsToArchive(base: ArchiveIndex, archiveConfig?: ArchiveConfigJSON | null): ArchiveIndex {
  const globalTags = archiveConfig?.globalTags?.length ? archiveConfig.globalTags : DEFAULT_GLOBAL_TAGS;
  if (base.config.globalTags === globalTags) return base;
  return { ...base, config: { ...base.config, globalTags } };
}

async function readDictionaryIndexCache(): Promise<DictionaryIndex | null> {
  if (typeof window !== "undefined") return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "lib", "generated", "dictionary-index.json");
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as DictionaryIndex;
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchDictionaryEntry(
  id: string
): Promise<DictionaryEntry> {
  const path = `dictionary/entries/${id}.json`;
  return fetchJSONRaw<DictionaryEntry>(path);
}

export function findPostBySlug(posts: ArchiveListItem[], slug: string): ArchiveListItem | undefined {
  const lower = slug.toLowerCase();
  return posts.find((p) => p.slug.toLowerCase() === lower || slugMatchesEntry(lower, p.entry));
}
