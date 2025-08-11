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
  post?: DiscordPostReference;
  timestamp: number;
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
  timestamp: number;
  path: string; // folder within channel
  tags: string[]; // tag names available at the entry reference level
}

export interface ArchiveConfig { archiveChannels: ChannelRef[] }

export type ArchiveComment = {
    id: string; // Unique identifier for the comment
    sender: Author;
    content: string; // The content of the comment
    attachments: Attachment[]; // List of attachments associated with the comment
    timestamp: number; // Timestamp of when the comment was made
}