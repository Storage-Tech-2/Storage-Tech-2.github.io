import { fetchArrayBufferRaw, fetchJSONRaw } from "./github";
import {
  ArchiveComment,
  ArchiveConfig,
  ArchivedPostReference,
  ArchiveEntryData,
  ChannelRef,
  DictionaryConfig,
  DictionaryEntry,
  IndexEntry,
  IndexedDictionaryEntry,
  IndexedPost,
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

function persistentIndexToArchive(idx: PersistentIndex): ArchiveIndex {
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
      posts.push({ channel: channelRef, entry: entryRef, slug: buildEntrySlug(entryRef) });
    });
  });

  posts.sort((a, b) => (getEntryUpdatedAt(b.entry) ?? 0) - (getEntryUpdatedAt(a.entry) ?? 0));

  const config: ArchiveConfig = {
    postStyle: idx.schemaStyles || {},
    updatedAt: idx.updated_at,
    allTags: tags,
    allAuthors: authors,
    allCategories: categories,
  };

  return { config, channels, posts };
}

export async function fetchArchiveIndex(): Promise<ArchiveIndex> {
  const cached = await readArchiveIndexCache();
  if (cached) return cached;
  const buffer = await fetchArrayBufferRaw("persistent.idx");
  const idx = deserializePersistentIndex(buffer);
  return persistentIndexToArchive(idx);
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
