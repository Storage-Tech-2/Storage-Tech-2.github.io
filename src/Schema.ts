export type Snowflake = string;

export enum AuthorType {
  DiscordInGuild = "discord-in-guild",
  DiscordExternal = "discord-external",
  DiscordDeleted = "discord-deleted",
  Unknown = "unknown",
}

export type Author = {
  type: AuthorType,
  id?: string,
  username?: string,
  displayName?: string,
  iconURL?: string,
  reason?: string,
  dontDisplay?: boolean,
  url?: string,
}

export type Tag = { id: string; name: string }

export type Image = {
  id: Snowflake,
  name: string,
  url: string,
  description: string,
  contentType: string,
  width?: number,
  height?: number,
  canDownload: boolean,
  path?: string,
}

export type Attachment = {
  id: Snowflake,
  name: string,
  url: string,
  description: string,
  contentType: string,
  litematic?: { version?: string, size?: string, error?: string },
  wdl?: { version?: string, error?: string },
  youtube?: {
    title: string,
    author_name: string,
    author_url: string,
    thumbnail_url: string,
    thumbnail_width: number,
    thumbnail_height: number,
    width: number,
    height: number,
  },
  canDownload: boolean,
  path?: string,
}

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
}

export type StyleInfo = {
  depth?: number;
  headerText?: string;
  isOrdered?: boolean;
}


export enum ReferenceType {
  DISCORD_LINK = "discordLink",
  DICTIONARY_TERM = "dictionaryTerm",
  ARCHIVED_POST = "archivedPost"
}

export type ReferenceBase = {
  type: ReferenceType,
  matches: string[]
}

export type DiscordLinkReference = ReferenceBase & {
  type: ReferenceType.DISCORD_LINK,
  url: string,
  server: Snowflake,
  serverName?: string,
  serverJoinURL?: string,
  channel: Snowflake,
  message?: Snowflake,
}

export type DictionaryTermReference = ReferenceBase & {
  type: ReferenceType.DICTIONARY_TERM,
  term: string,
  id: Snowflake,
}

export type ArchivedPostReference = ReferenceBase & {
  type: ReferenceType.ARCHIVED_POST,
  id: Snowflake,
  code: string,
}

export type Reference = DiscordLinkReference | DictionaryTermReference | ArchivedPostReference;


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
  timestamp?: number; // legacy
  archivedAt: number;
  updatedAt: number;
}

export interface ChannelRef {
  id: Snowflake;
  name: string;      // slug
  code: string;      // short code, like FL
  category: string;
  path: string;      // folder from repo root
  description: string;
  availableTags: string[]; // list of tag names available in this channel
}

export interface ChannelData extends Omit<ChannelRef, "path"> {
  currentCodeId: number;
  entries: EntryRef[];
}

export interface EntryRef {
  id: Snowflake;
  name: string;
  code: string;
  timestamp?: number; // legacy
  archivedAt: number;
  updatedAt: number;
  path: string; // folder within channel
  tags: string[]; // tag names available at the entry reference level
}

export interface ArchiveConfig {
  archiveChannels: ChannelRef[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postSchema: any; // JSON Schema for validating posts
  postStyle: Record<string, StyleInfo>;
}

export type ArchiveComment = {
  id: string; // Unique identifier for the comment
  sender: Author;
  content: string; // The content of the comment
  attachments: Attachment[]; // List of attachments associated with the comment
  timestamp: number; // Timestamp of when the comment was made
}

export type DictionaryIndexEntry = {
  id: Snowflake,
  terms: string[]
  summary: string,
  updatedAt: number,
}

export type DictionaryConfig = {
  entries: DictionaryIndexEntry[]
}

export type DictionaryEntry = {
    id: Snowflake;
    terms: string[];
    definition: string;
    threadURL: string;
    statusURL: string;
    statusMessageID?: Snowflake;
    updatedAt: number;
    references: Reference[];
    referencedBy?: string[]; // list of codes of entries that reference this one
}