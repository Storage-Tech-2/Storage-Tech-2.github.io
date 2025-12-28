
// ------------------------------
// Utils

import type { IndexedPost } from "./App"
import { DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH } from "./Constants"
import { AuthorType, ReferenceType, type Attachment, type Author, type NestedListItem, type Reference, type StyleInfo, type SubmissionRecord, type SubmissionRecords, type ArchivedPostReference } from "./Schema"

// ------------------------------
export function clsx(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(" ")
}

export function formatDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

export function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const sec = Math.round(diff / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  const yr = Math.round(day / 365)
  if (sec < 60) return `${sec}s ago`
  if (min < 60) return `${min}m ago`
  if (hr < 48) return `${hr}h ago`
  if (day < 365) return `${day}d ago`
  return `${yr}y ago`
}

export function normalize(s?: string) {
  return (s || "").toLowerCase()
}

export function unique<T>(xs: T[]) { return Array.from(new Set(xs)) }

export function getAuthorName(a: Author) {
  return a.displayName || a.username || a.reason || (a.type === AuthorType.DiscordDeleted ? "Deleted" : "Unknown")
}

// Collect normalized tag names for a post from entry ref and loaded data
export function getPostTagsNormalized(p: IndexedPost): string[] {
  const entryTags = p.entry?.tags || []
  const loadedTags = p.data?.tags?.map(t => t.name) || []
  return unique([...entryTags, ...loadedTags]).map(normalize)
}

// Build a RAW GitHub URL for a repo path
function getRawURL(owner: string, repo: string, branch: string, path: string) {
  const safe = encodeURI(path.replace(/^\/+/, ""))
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${safe}`
}

// Safe path join for channel, entry, and relative asset paths
export function assetURL(
  channelPath: string,
  entryPath: string,
  rel: string,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
) {
  // Normalize each segment, collapse duplicate slashes, then remove any leading slash
  const joined = [channelPath, entryPath, rel]
    .join("/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
  return getRawURL(owner, repo, branch, joined)
}

// Derive a YouTube embed URL from common forms (watch, youtu.be, shorts, embed)
export function getYouTubeEmbedURL(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')
    let id: string | null = null
    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0] || null
    } else if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v')
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || null
      else if (u.pathname.startsWith('/embed/')) return raw
    }
    if (!id) return null
    const start = u.searchParams.get('t') || u.searchParams.get('start')
    const qs = start ? `?start=${encodeURIComponent(start)}&rel=0` : '?rel=0'
    return `https://www.youtube.com/embed/${id}${qs}`
  } catch {
    return null
  }
}

export async function fetchJSONRaw(path: string, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
  const url = getRawURL(owner, repo, branch, path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json()
}

// Simple pool to limit concurrent fetches
export async function asyncPool<T, R>(limit: number, items: T[], fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  const workers: Promise<void>[] = []
  async function work() {
    while (i < items.length) {
      const cur = i++
      results[cur] = await fn(items[cur], cur)
    }
  }
  for (let k = 0; k < Math.max(1, Math.min(limit, items.length)); k++) workers.push(work())
  await Promise.allSettled(workers)
  return results
}

export function replaceAttachmentsInText(text: string, attachments: Attachment[]): string {
  // Find all URLs in the message
  let finalText = text;
  const urls = text.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g)
  if (urls) {
    urls.forEach(url => {
      // Check if mediafire
      // https://www.mediafire.com/file/idjbw9lc1kt4obj/1_17_Crafter-r2.zip/file
      // https://www.mediafire.com/folder/5ajiire4a6cs5/Scorpio+MIS
      let match = null;
      if (url.startsWith('https://www.mediafire.com/file/') || url.startsWith('https://www.mediafire.com/folder/')) {
        const id = url.split('/')[4]
        // check if duplicate
        match = attachments.find(attachment => attachment.id === id);
      } else if (url.startsWith('https://youtu.be/') || url.startsWith('https://www.youtube.com/watch')) {
        // YouTube links
        const videoId = new URL(url).searchParams.get('v') || url.split('/').pop();
        if (!videoId) return;
        match = attachments.find(attachment => attachment.id === videoId);
      } else if (url.startsWith('https://cdn.discordapp.com/attachments/')) {
        const id = url.split('/')[5]
        match = attachments.find(attachment => attachment.id === id);
      } else if (url.startsWith('https://bilibili.com/') || url.startsWith('https://www.bilibili.com/')) {
        // Bilibili links
        const urlObj = new URL(url);
        const videoId = urlObj.pathname.split('/')[2] || urlObj.searchParams.get('bvid');
        if (!videoId) return;
        match = attachments.find(attachment => attachment.id === videoId);
      }

      if (!match) return;

      // replace all instances of the URL with a placeholder if its a naked url, not wrapped in markdown
      const finalTextSplit = finalText.split(url);
      if (finalTextSplit.length > 1) {

        const finalTextReplaced = [finalTextSplit[0]];
        for (let j = 1; j < finalTextSplit.length; j++) {
          // check if the previous character is not a markdown link
          if (finalTextSplit[j - 1].endsWith('](') && finalTextSplit[j].startsWith(')')) {
            // if it is, just add the url
            finalTextReplaced.push(match.canDownload ? match.path : url);
          } else {
            // otherwise, add a placeholder
            finalTextReplaced.push(`[${match.name || 'Attachment'}](${match.canDownload ? match.path : url})`);
          }
          finalTextReplaced.push(finalTextSplit[j]);
        }

        finalText = finalTextReplaced.join('');
      }
    })
  }
  return finalText;
}


export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export type StrictStyleInfo = {
  depth: number;
  headerText: string;
  isOrdered: boolean;
}

export function getEffectiveStyle(key: string, schemaStyles?: Record<string, StyleInfo>, recordStyles?: Record<string, StyleInfo>): StrictStyleInfo {
  const recordStyle = Object.hasOwn(recordStyles || {}, key) ? recordStyles![key] : null;
  const schemaStyle = Object.hasOwn(schemaStyles || {}, key) ? schemaStyles![key] : null;

  const style = {
    depth: 2,
    headerText: capitalizeFirstLetter(key),
    isOrdered: false,
  }
  if (schemaStyle) {
    if (schemaStyle.depth !== undefined) style.depth = schemaStyle.depth;
    if (schemaStyle.headerText !== undefined) style.headerText = schemaStyle.headerText;
    if (schemaStyle.isOrdered !== undefined) style.isOrdered = schemaStyle.isOrdered;
  }
  if (recordStyle) {
    if (recordStyle.depth !== undefined) style.depth = recordStyle.depth;
    if (recordStyle.headerText !== undefined) style.headerText = recordStyle.headerText;
    if (recordStyle.isOrdered !== undefined) style.isOrdered = recordStyle.isOrdered;
  }
  return style;
}


export function nestedListToMarkdown(nestedList: NestedListItem, indentLevel: number = 0): string {
  let markdown = "";
  const indent = "  ".repeat(indentLevel);
  if (nestedList.isOrdered) {
    nestedList.items.forEach((item, index) => {
      if (typeof item === "string") {
        markdown += `${indent}${index + 1}. ${item}\n`;
      } else if (typeof item === "object") {
        markdown += `${indent}${index + 1}. ${item.title}\n`;
        if (item.items.length > 0) {
          markdown += nestedListToMarkdown(item, indentLevel + 1);
        }
      }
    })
  } else {
    nestedList.items.forEach((item) => {
      if (typeof item === "string") {
        markdown += `${indent}- ${item}\n`;
      } else if (typeof item === "object") {
        markdown += `${indent}- ${item.title}\n`;
        if (item.items.length > 0) {
          markdown += nestedListToMarkdown(item, indentLevel + 1);
        }
      }
    });
  }
  return markdown.trim();
}


export function submissionRecordToMarkdown(value: SubmissionRecord, style?: StyleInfo): string {
  let markdown = "";
  if (Array.isArray(value)) {
    if (value.length !== 0) {
      markdown += value.map((item, i) => {
        if (typeof item === "string") {
          return style?.isOrdered ? `${i + 1}. ${item}` : `- ${item}`;
        } else if (typeof item === "object") {
          return style?.isOrdered ? `${i + 1}. ${item.title}\n${nestedListToMarkdown(item, 1)}` : `- ${item.title}\n${nestedListToMarkdown(item, 1)}`;
        }
        return "";
      }).join("\n");
    }
  } else {
    markdown += `${value}\n`;
  }

  return markdown.trim();
}


export function postToMarkdown(record: SubmissionRecords, recordStyles?: Record<string, StyleInfo>, schemaStyles?: Record<string, StyleInfo>): string {
  let markdown = "";

  let isFirst = true;
  for (const key in record) {
    const recordValue = record[key];
    const styles = getEffectiveStyle(key, schemaStyles, recordStyles);

    const text = submissionRecordToMarkdown(recordValue, styles);
    if (text.length > 0) {
      if (key !== "description" || !isFirst) {
        markdown += `\n${'#'.repeat(styles.depth)} ${styles.headerText}\n`;
      }
      isFirst = false;
    }
    markdown += text;
  }

  return markdown.trim();
}



export type RegexMatch = {
  pattern: string;
  match: string;
  start: number;
  end: number;
  groups: (string | undefined)[];
};

/**
 * Find matches for arbitrary regex patterns (must be global) in the provided text.
 * This can be used to dynamically include patterns like post codes or Discord forum links.
 */
export function findRegexMatches(text: string, patterns: RegExp[]): RegexMatch[] {
  const results: RegexMatch[] = [];
  for (const pattern of patterns) {
    if (!pattern.global) {
      // ensure global flag for iterative matching
      const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
      const globalPattern = new RegExp(pattern.source, flags);
      collectMatches(globalPattern);
    } else {
      collectMatches(pattern);
    }
  }
  return results;

  function collectMatches(regex: RegExp) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const matched = match[0];
      const start = match.index;
      results.push({
        pattern: regex.source,
        match: matched,
        start,
        end: start + matched.length,
        groups: match.slice(1),
      });
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }
}


export type Snowflake = string;

export type ServerLinksMap = Map<Snowflake, { id: Snowflake, name: string, joinURL: string }>;

export const DiscordForumLinkPattern = /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/(\d+))?/g;


export function findMatchesWithinText(text: string, references: Reference[]): {
  reference: Reference;
  start: number;
  end: number;
}[] {
  const matches: {
    reference: Reference;
    start: number;
    end: number;
  }[] = [];

  for (const ref of references) {
    for (const matchText of ref.matches) {
      let startIndex = 0;
      while (startIndex < text.length) {
        const index = text.indexOf(matchText, startIndex);
        if (index === -1) break;
        matches.push({
          reference: ref,
          start: index,
          end: index + matchText.length,
        });
        startIndex = index + matchText.length;
      }
    }
  }

  return matches;
}

export function transformOutputWithReferences(
  text: string,
  references: Reference[],
  dictionaryTooltipLookup?: (id: string) => string | undefined,
  postTooltipLookup?: (ref: ArchivedPostReference) => string | undefined,
): {
  result: string,
} {
  const matches = findMatchesWithinText(text, references);
  if (matches.length === 0) {
    return {
      result: text,
    }
  }

  const excludedIDs: Set<Snowflake> = new Set();

  // first, filter out matches that are not at word boundaries
  const isWordChar = (ch: string | undefined): boolean => {
    if (!ch) return false;
    return /[A-Za-z]/.test(ch);
  };

  const filteredMatches = matches.filter(({ start, end }) => {
    const before = start > 0 ? text[start - 1] : undefined;
    const after = end < text.length ? text[end] : undefined;
    return !isWordChar(before) && !isWordChar(after);
  });

  filteredMatches.sort((a, b) => a.start - b.start);

  // remove overlapping matches, prefer earlier matches
  const dedupedMatches: typeof matches = [];
  let lastEnd = -1;
  for (const match of filteredMatches) {
    if (match.start >= lastEnd) {
      dedupedMatches.push(match);
      lastEnd = match.end;
    }
  }

  // detect markdown hyperlinks
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const hyperlinks = findRegexMatches(text, [regex]);

  const resultParts: string[] = [];
  let currentIndex = 0;

  // if a match is within a hyperlink, do custom processing
  for (const match of dedupedMatches) {
    if (match.reference.type === ReferenceType.DICTIONARY_TERM && excludedIDs.has(match.reference.id)) {
      continue;
    }

    // check if in header (#'s in front)
    let inHeader = false;
    const lastNewline = text.lastIndexOf('\n', match.start);
    if (lastNewline !== -1) {
      const lineStart = lastNewline + 1;
      let i = lineStart;
      while (i < match.start && text[i] === ' ') {
        i++;
      }
      let hashCount = 0;
      while (i < match.start && text[i] === '#') {
        hashCount++;
        i++;
      }
      if (hashCount > 0) {
        inHeader = true;
      }
    }
    if (inHeader) { // skip
      continue;
    }

    // check if match is within a hyperlink
    const hyperlink = hyperlinks.find(h => match.start >= h.start && match.end <= h.end);

    if (hyperlink) {
      // add text before hyperlink
      if (currentIndex < hyperlink.start) {
        resultParts.push(text.slice(currentIndex, hyperlink.start));
      }
    } else {
      // add text before match
      if (currentIndex < match.start) {
        resultParts.push(text.slice(currentIndex, match.start));
      }
    }

    const ref = match.reference;


    if (ref.type === ReferenceType.DICTIONARY_TERM) {
      const tooltip = dictionaryTooltipLookup?.(ref.id)
      const safeTitle = tooltip ? tooltip.replace(/"/g, "'") : undefined
      if (hyperlink) { // skip
        if (safeTitle) {
          const linkText = hyperlink.groups[0] || "";
          const existingUrl = hyperlink.groups[1] || "";
          const linkedText = `[${linkText}](${existingUrl} "Definition: ${safeTitle}")`;
          resultParts.push(linkedText);
        } else {
          resultParts.push(text.slice(hyperlink.start, hyperlink.end));
        }
        currentIndex = hyperlink.end;
      } else {
        // create markdown link
        const newURL = new URL(window.location.href);
        newURL.searchParams.set('did', ref.id);
        const linkText = text.slice(match.start, match.end)
        const withTitle = safeTitle ? `[${linkText}](${newURL.href} "Definition: ${safeTitle}")` : `[${linkText}](${newURL.href})`;
        resultParts.push(withTitle);
        currentIndex = match.end;
        excludedIDs.add(ref.id);
      }
    } else if (ref.type === ReferenceType.ARCHIVED_POST) {
      const newURL = new URL(window.location.href);
      newURL.searchParams.set('id', ref.id);
      newURL.searchParams.delete('did');
      const tooltip = postTooltipLookup?.(ref)
      const safeTitle = tooltip ? tooltip.replace(/"/g, "'") : undefined
      if (hyperlink) { // dont skip, replace
        // get hyperlink text
        const linkText = hyperlink.groups[0] || "";



        if (linkText.toUpperCase() === ref.code) {
          // same as code, just replace URL
          const linkedText = safeTitle ? `[${linkText}](${newURL.href} "${safeTitle}")` : `[${linkText}](${newURL.href})`;
          resultParts.push(linkedText);
        } else {
          // different, keep text but add suffix
          const linkedText = safeTitle ? `[${linkText} (${ref.code})](${newURL.href} "${safeTitle}")` : `[${linkText} (${ref.code})](${newURL.href})`;
          resultParts.push(linkedText);
        }
        currentIndex = hyperlink.end;
      } else {
        // create markdown link with code as text
        const linkedText = safeTitle ? `[${ref.code}](${newURL.href} "${safeTitle}")` : `[${ref.code}](${newURL.href})`;
        resultParts.push(linkedText);
        currentIndex = match.end;
      }
    } else if (ref.type === ReferenceType.DISCORD_LINK) {

      if (hyperlink) {
        resultParts.push(text.slice(hyperlink.start, hyperlink.end));
        currentIndex = hyperlink.end;
      } else {
        const safeText = ref.serverName ? `in ${ref.serverName.replaceAll(/"/g, "'")}` : 'on Discord';
        const linkedText = `[[Link to message]](${ref.url} "${safeText}")`;
        resultParts.push(linkedText);
        currentIndex = match.end;
      }

      if (ref.serverName && ref.serverJoinURL) {
        // add server
        resultParts.push(` ([Join ${ref.serverName}](${ref.serverJoinURL}))`);
      }
    } else if (ref.type === ReferenceType.USER_MENTION) {
      if (hyperlink) { // skip
        resultParts.push(text.slice(hyperlink.start, hyperlink.end));
        currentIndex = hyperlink.end;
      } else {
        const text = ref.user.displayName || ref.user.username || "Unknown User";
        resultParts.push(`[@${text}](# "ID: ${ref.user.id}")`);
        currentIndex = match.end;
      }
    } else if (ref.type === ReferenceType.CHANNEL_MENTION) {
      if (hyperlink) { // skip
        resultParts.push(text.slice(hyperlink.start, hyperlink.end));
        currentIndex = hyperlink.end;
      } else if (ref.channelName && ref.channelURL) {
        const linkedText = `[#${ref.channelName}](${ref.channelURL})`;
        resultParts.push(linkedText);
        currentIndex = match.end;
      } else {
        const linkedText = `[Unknown Channel](# "ID: ${ref.channelID}")`;
        resultParts.push(linkedText);
        currentIndex = match.end;
      }
    }

  }

  // add remaining text
  if (currentIndex < text.length) {
    resultParts.push(text.slice(currentIndex));
  }

  return {
    result: resultParts.join(''),
  }
}
