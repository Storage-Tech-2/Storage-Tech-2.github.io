import { asyncPool, fetchJSONRaw } from "./github";
import {
  ArchiveComment,
  ArchiveConfig,
  ArchivedPostReference,
  ArchiveEntryData,
  ChannelData,
  ChannelRef,
  DEFAULT_BRANCH,
  DEFAULT_OWNER,
  DEFAULT_REPO,
  DictionaryConfig,
  DictionaryEntry,
  EntryRef,
  IndexedDictionaryEntry,
  IndexedPost,
} from "./types";

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

export function buildEntrySlug(entry: EntryRef | ArchivedPostReference) {
  const base = entry.code;
  const name = entry.name ? slugifyName(entry.name) : "";
  if (!name) return base;
  return `${base}-${name}`;
}

export function slugMatchesEntry(slug: string, entry: EntryRef) {
  const lowerSlug = slug.toLowerCase();
  const entrySlug = buildEntrySlug(entry).toLowerCase();
  if (lowerSlug === entrySlug) return true;
  const slugCode = lowerSlug.split("-")[0];
  return !!slugCode && slugCode === (entry.code || entry.id).toLowerCase();
}

export async function fetchArchiveIndex(
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  cache: RequestCache = "force-cache",
): Promise<ArchiveIndex> {
  if (cache !== "no-store") {
    const cached = await readArchiveIndexCache();
    if (cached) return cached;
  }
  const config = await fetchArchiveConfig(owner, repo, branch, cache);
  const channels = config.archiveChannels || [];

  const channelDatas = await asyncPool(6, channels, async (channel) => {
    try {
      const data = await fetchJSONRaw<ChannelData>(`${channel.path}/data.json`, owner, repo, branch, cache);
      return { channel, data };
    } catch {
      return { channel, data: { ...channel, currentCodeId: 0, entries: [] } as ChannelData };
    }
  });

  const posts: ArchiveListItem[] = [];
  channelDatas.forEach(({ channel, data }) => {
    data.entries.forEach((entry) => posts.push({ channel, entry, slug: buildEntrySlug(entry) }));
  });
  posts.sort((a, b) => (b.entry.updatedAt ?? 0) - (a.entry.updatedAt ?? 0));

  return { config, channels, posts };
}

export async function fetchArchiveConfig(
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  cache: RequestCache = "force-cache",
): Promise<ArchiveConfig> {
  return fetchJSONRaw<ArchiveConfig>("config.json", owner, repo, branch, cache);
}

export async function fetchChannelData(
  channelPath: string,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  cache: RequestCache = "force-cache",
): Promise<ChannelData> {
  const path = `${channelPath}/data.json`;
  return fetchJSONRaw<ChannelData>(path, owner, repo, branch, cache);
}

export type PostWithArchive = {
  archive: ArchiveIndex;
  post: ArchiveListItem;
  data: ArchiveEntryData;
};

const postPayloadCache = new Map<string, Promise<PostWithArchive | null>>();

export async function fetchPostData(
  channelPath: string,
  entry: EntryRef,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  cache: RequestCache = "force-cache",
): Promise<ArchiveEntryData> {
  const path = `${channelPath}/${entry.path}/data.json`;
  return fetchJSONRaw<ArchiveEntryData>(path, owner, repo, branch, cache);
}

export function buildPostPayloadKey(slug: string, cache: RequestCache) {
  return `${cache}:${slug.toLowerCase()}`;
}

export async function fetchPostWithArchive(
  slug: string,
  cache: RequestCache = "force-cache",
): Promise<PostWithArchive | null> {
  const key = buildPostPayloadKey(slug, cache);
  const existing = postPayloadCache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const archive = await fetchArchiveIndex(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, cache);
    const match = findPostBySlug(archive.posts, slug);
    if (!match) return null;
    const data = await fetchPostData(match.channel.path, match.entry, DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH, cache);
    return { archive, post: match, data };
  })();

  postPayloadCache.set(key, promise);
  return promise;
}

export async function fetchCommentsData(
  channelPath: string,
  entry: EntryRef,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  cache: RequestCache = "force-cache",
): Promise<ArchiveComment[]> {
  const path = `${channelPath}/${entry.path}/comments.json`;
  try {
    return await fetchJSONRaw<ArchiveComment[]>(path, owner, repo, branch, cache);
  } catch {
    return [];
  }
}

export async function fetchDictionaryIndex(
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  cache: RequestCache = "force-cache",
): Promise<DictionaryIndex> {
  if (cache !== "no-store") {
    const cached = await readDictionaryIndexCache();
    if (cached) return cached;
  }
  const config = await fetchJSONRaw<DictionaryConfig>("dictionary/config.json", owner, repo, branch, cache);
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
  id: string,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  cache: RequestCache = "force-cache",
): Promise<DictionaryEntry> {
  const path = `dictionary/entries/${id}.json`;
  return fetchJSONRaw<DictionaryEntry>(path, owner, repo, branch, cache);
}

export function findPostBySlug(posts: ArchiveListItem[], slug: string): ArchiveListItem | undefined {
  const lower = slug.toLowerCase();
  return posts.find((p) => p.slug.toLowerCase() === lower || slugMatchesEntry(lower, p.entry));
}
