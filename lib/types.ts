import { siteConfig } from "./siteConfig";

export type Snowflake = string;

export enum AuthorType {
  DiscordInGuild = "discord-in-guild",
  DiscordLeftGuild = "discord-left-guild",
  DiscordExternal = "discord-external",
  DiscordDeleted = "discord-deleted",
  Unknown = "unknown",
}

export type BaseAuthor = {
  type: AuthorType;
  username: string;
  reason?: string;
  dontDisplay?: boolean;
  url?: string;
};

export type DiscordWithNameAuthor = BaseAuthor & {
  type: AuthorType.DiscordInGuild | AuthorType.DiscordLeftGuild;
  id: Snowflake;
  displayName: string;
  iconURL: string;
};

export type DiscordExternalAuthor = BaseAuthor & {
  type: AuthorType.DiscordExternal;
  id: Snowflake;
  iconURL: string;
};

export type DiscordDeletedAuthor = BaseAuthor & {
  type: AuthorType.DiscordDeleted;
  id: Snowflake;
};

export type UnknownAuthor = BaseAuthor & {
  type: AuthorType.Unknown;
};

export type AllAuthorPropertiesAccessor = BaseAuthor & {
  id?: Snowflake;
  username: string;
  displayName?: string;
  iconURL?: string;
};

export type DiscordAuthor = DiscordWithNameAuthor | DiscordExternalAuthor | DiscordDeletedAuthor;
export type Author = DiscordAuthor | UnknownAuthor;

export type Tag = { id: string; name: string };

export type Image = {
  id: Snowflake;
  name: string;
  url: string;
  description: string;
  contentType: string;
  width?: number;
  height?: number;
  canDownload: boolean;
  path?: string;
};

export type Attachment = {
  id: Snowflake;
  name: string;
  url: string;
  description: string;
  contentType: string;
  litematic?: { version?: string; size?: string; error?: string };
  wdl?: { version?: string; error?: string };
  youtube?: {
    title: string;
    author_name: string;
    author_url: string;
    thumbnail_url: string;
    thumbnail_width: number;
    thumbnail_height: number;
    width: number;
    height: number;
  };
  canDownload: boolean;
  path?: string;
};

export type NestedListItem = { title: string; isOrdered: boolean; items: (string | NestedListItem)[] };
export type SubmissionRecord = string | (string | NestedListItem)[];
export type SubmissionRecords = Record<string, SubmissionRecord>;

export type DiscordPostReference = {
  forumId?: Snowflake;
  threadId: Snowflake;
  continuingMessageIds?: Snowflake[];
  threadURL?: string;
  attachmentMessageId?: Snowflake;
  uploadMessageId?: Snowflake;
};

export type StyleInfo = {
  depth?: number;
  headerText?: string;
  isOrdered?: boolean;
};

export enum ReferenceType {
  DISCORD_LINK = "discordLink",
  DICTIONARY_TERM = "dictionaryTerm",
  ARCHIVED_POST = "archivedPost",
  USER_MENTION = "userMention",
  CHANNEL_MENTION = "channelMention",
}

export type ReferenceBase = {
  type: ReferenceType;
  matches: string[];
};

export type DiscordLinkReference = ReferenceBase & {
  type: ReferenceType.DISCORD_LINK;
  url: string;
  server: Snowflake;
  serverName?: string;
  serverJoinURL?: string;
  channel: Snowflake;
  message?: Snowflake;
};

export type DictionaryTermReference = ReferenceBase & {
  type: ReferenceType.DICTIONARY_TERM;
  term: string;
  id: Snowflake;
  url: string;
};

export type ArchivedPostReference = ReferenceBase & {
  type: ReferenceType.ARCHIVED_POST;
  id: Snowflake;
  name: string;
  code: string;
  url: string;
};

export type UserMentionReference = ReferenceBase & {
  type: ReferenceType.USER_MENTION;
  user: DiscordAuthor;
};

export type ChannelMentionReference = ReferenceBase & {
  type: ReferenceType.CHANNEL_MENTION;
  channelID: Snowflake;
  channelName?: string;
  channelURL?: string;
};

export type Reference = DiscordLinkReference | DictionaryTermReference | ArchivedPostReference | UserMentionReference | ChannelMentionReference;

export type ArchiveEntryData = {
  id: Snowflake;
  name: string;
  code: string;
  authors: Author[];
  endorsers: Author[];
  tags: Tag[];
  images: Image[];
  attachments: Attachment[];
  records: SubmissionRecords;
  styles: Record<string, StyleInfo>;
  references: Reference[];
  author_references: Reference[];
  post?: DiscordPostReference;
  timestamp?: number;
  archivedAt: number;
  updatedAt: number;
};

export interface ChannelRef {
  code: string;
  name: string;
  category: string;
  path: string;
  description: string;
  availableTags: string[];
}

export interface EntryRef {
  id: Snowflake;
  name: string;
  code: string;
  codes: string[];
  timestamp?: number;
  archivedAt?: number;
  updatedAt?: number;
  path: string;
  tags?: string[];
  authors?: string[];
  mainImagePath?: string | null;
}

export interface ArchiveConfig {
  postStyle: Record<string, StyleInfo>;
  updatedAt?: number;
  allTags?: string[];
  allAuthors?: string[];
  allCategories?: string[];
}

export type ArchiveComment = {
  id: string;
  sender: Author;
  content: string;
  attachments: Attachment[];
  timestamp: number;
};

export type DictionaryIndexEntry = {
  id: Snowflake;
  terms: string[];
  summary: string;
  updatedAt: number;
};

export type DictionaryConfig = {
  entries: DictionaryIndexEntry[];
};

export type DictionaryEntry = {
  id: Snowflake;
  terms: string[];
  definition: string;
  threadURL: string;
  statusURL: string;
  statusMessageID?: Snowflake;
  updatedAt: number;
  references: Reference[];
};

export type IndexedPost = {
  channel: ChannelRef;
  entry: EntryRef;
  data?: ArchiveEntryData;
};

export type IndexedDictionaryEntry = {
  index: DictionaryIndexEntry;
  data?: DictionaryEntry;
};

export type SortKey = "newest" | "oldest" | "archived" | "archivedOldest" | "az";

export const getEntryUpdatedAt = (entry: Pick<EntryRef, "updatedAt" | "archivedAt" | "timestamp">) =>
  entry.updatedAt ?? entry.archivedAt ?? entry.timestamp;
export const getEntryArchivedAt = (entry: Pick<EntryRef, "updatedAt" | "archivedAt" | "timestamp">) =>
  entry.archivedAt ?? entry.timestamp ?? entry.updatedAt;

export const USE_RAW = true;
export const DEFAULT_OWNER = process.env.NEXT_PUBLIC_ARCHIVE_OWNER || siteConfig.archiveRepo.owner;
export const DEFAULT_REPO = process.env.NEXT_PUBLIC_ARCHIVE_REPO || siteConfig.archiveRepo.repo;
export const DEFAULT_BRANCH = process.env.NEXT_PUBLIC_ARCHIVE_BRANCH || siteConfig.archiveRepo.branch;
