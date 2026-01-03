import { ReferenceType, type ArchivedPostReference, type Reference } from "../types"
import { getAuthorName } from "./authors";

export type RegexMatch = {
  pattern: string;
  match: string;
  start: number;
  end: number;
  groups: (string | undefined)[];
}

export type Snowflake = string

export type ServerLinksMap = Map<Snowflake, { id: Snowflake, name: string, joinURL: string }>

export const DiscordForumLinkPattern = /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/(\d+))?/g

export function findRegexMatches(text: string, patterns: RegExp[]): RegexMatch[] {
  const results: RegexMatch[] = []
  for (const pattern of patterns) {
    if (!pattern.global) {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
      const globalPattern = new RegExp(pattern.source, flags)
      collectMatches(globalPattern)
    } else {
      collectMatches(pattern)
    }
  }
  return results

  function collectMatches(regex: RegExp) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const matched = match[0]
      const start = match.index
      results.push({
        pattern: regex.source,
        match: matched,
        start,
        end: start + matched.length,
        groups: match.slice(1),
      })
      if (match[0].length === 0) {
        regex.lastIndex++
      }
    }
  }
}

function shouldIncludeMatch(text: string, term: string, start: number, end: number): boolean {
  const isTermAllCaps = term.toUpperCase() === term
  const matchedText = text.slice(start, end)

  if (isTermAllCaps && matchedText !== term) return false

  const before = start > 0 ? text[start - 1] : undefined
  const after = end < text.length ? text[end] : undefined

  if (/^[0-9]/.test(term)) {
    if (before && (/[0-9.]/.test(before))) return false
  }

  if (/[0-9x.]$/.test(term)) {
    if (after && /[0-9]/.test(after)) return false
  }

  const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[A-Za-z]/.test(ch)

  const startSatisfied = isWordChar(before) === false
  let endingSatisfied = isWordChar(after) === false

  if (startSatisfied && endingSatisfied) return true

  const hasNoNumbers = !/[0-9]/.test(term)

  if (hasNoNumbers && startSatisfied && !endingSatisfied) {
    const getSliceAtEnd = (len: number): string => text.slice(end, Math.min(end + len, text.length))
    const getCharAt = (pos: number): string | undefined => {
      pos += end
      return pos < text.length ? text[pos] : undefined
    }

    if (getCharAt(0) === "s" && !isWordChar(getCharAt(1))) {
      endingSatisfied = true
    } else if (getSliceAtEnd(2) === "ed" && !isWordChar(getCharAt(2))) {
      endingSatisfied = true
    } else if (getSliceAtEnd(3) === "ing" && !isWordChar(getCharAt(3))) {
      endingSatisfied = true
    } else if (getSliceAtEnd(2) === "er" && !isWordChar(getCharAt(2))) {
      endingSatisfied = true
    }

    if (endingSatisfied) return true
  }

  return false
}

export function findMatchesWithinText(text: string, references: Reference[]): {
  reference: Reference;
  start: number;
  end: number;
}[] {
  const matches: {
    reference: Reference;
    start: number;
    end: number;
  }[] = []

  for (const ref of references) {
    for (const matchText of ref.matches) {
      let startIndex = 0
      while (startIndex < text.length) {
        const index = text.indexOf(matchText, startIndex)
        if (index === -1) break
        matches.push({
          reference: ref,
          start: index,
          end: index + matchText.length,
        })
        startIndex = index + matchText.length
      }
    }
  }

  return matches
}

export function transformOutputWithReferences(
  text: string,
  references: Reference[],
  dictionaryTooltipLookup?: (id: string) => string | undefined,
  postTooltipLookup?: (ref: ArchivedPostReference) => string | undefined,
): { result: string } {
  const matches = findMatchesWithinText(text, references)
  if (matches.length === 0) return { result: text }

  const excludedIDs: Set<Snowflake> = new Set()

  const filteredMatches = matches.filter(({ start, end }) => shouldIncludeMatch(text, text.slice(start, end), start, end))

  filteredMatches.sort((a, b) => a.start - b.start)

  const dedupedMatches: typeof matches = []
  let lastEnd = -1
  for (const match of filteredMatches) {
    if (match.start >= lastEnd) {
      dedupedMatches.push(match)
      lastEnd = match.end
    }
  }

  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  const hyperlinks = findRegexMatches(text, [regex])

  const resultParts: string[] = []
  let currentIndex = 0

  for (const match of dedupedMatches) {
    if (match.reference.type === ReferenceType.DICTIONARY_TERM && excludedIDs.has(match.reference.id)) continue

    let inHeader = false
    const lastNewline = text.lastIndexOf("\n", match.start)
    if (lastNewline !== -1) {
      const lineStart = lastNewline + 1
      let i = lineStart
      while (i < match.start && text[i] === " ") i++
      let hashCount = 0
      while (i < match.start && text[i] === "#") { hashCount++; i++ }
      if (hashCount > 0) inHeader = true
    }
    if (inHeader) continue

    const hyperlink = hyperlinks.find(h => match.start >= h.start && match.end <= h.end)

    if (hyperlink) {
      if (currentIndex < hyperlink.start) resultParts.push(text.slice(currentIndex, hyperlink.start))
    } else {
      if (currentIndex < match.start) resultParts.push(text.slice(currentIndex, match.start))
    }

    const ref = match.reference

    const makeTextSafeForTooltip = (s?: string) => {
      if (!s) return s
      return s.replace(/"/g, "'").replace(/\n/g, " ").trim()
    }

    if (ref.type === ReferenceType.DICTIONARY_TERM) {
      const tooltip = dictionaryTooltipLookup?.(ref.id)
      const safeTitle = makeTextSafeForTooltip(tooltip)
      if (hyperlink) {
        resultParts.push(text.slice(hyperlink.start, hyperlink.end))
        currentIndex = hyperlink.end
      } else {
        const newURL = new URL(window.location.href)
        newURL.searchParams.set("did", ref.id)
        const linkText = text.slice(match.start, match.end)
        const withTitle = safeTitle ? `[${linkText}](${newURL.href} "Definition: ${safeTitle}")` : `[${linkText}](${newURL.href})`
        resultParts.push(withTitle)
        currentIndex = match.end
        excludedIDs.add(ref.id)
      }
    } else if (ref.type === ReferenceType.ARCHIVED_POST) {
      const newURL = new URL(window.location.href)
      newURL.searchParams.set("id", ref.id)
      newURL.searchParams.delete("did")
      const tooltip = postTooltipLookup?.(ref)
      const safeTitle = makeTextSafeForTooltip(tooltip)
      if (hyperlink) {
        const linkText = hyperlink.groups[0] || ""
        if (linkText.toUpperCase() === ref.code) {
          const linkedText = safeTitle ? `[${linkText}](${newURL.href} "${safeTitle}")` : `[${linkText}](${newURL.href})`
          resultParts.push(linkedText)
        } else {
          const linkedText = safeTitle ? `[${linkText} (${ref.code})](${newURL.href} "${safeTitle}")` : `[${linkText} (${ref.code})](${newURL.href})`
          resultParts.push(linkedText)
        }
        currentIndex = hyperlink.end
      } else {
        const linkedText = safeTitle ? `[${ref.code}](${newURL.href} "${safeTitle}")` : `[${ref.code}](${newURL.href})`
        resultParts.push(linkedText)
        currentIndex = match.end
      }
    } else if (ref.type === ReferenceType.DISCORD_LINK) {
      if (hyperlink) {
        resultParts.push(text.slice(hyperlink.start, hyperlink.end))
        currentIndex = hyperlink.end
      } else {
        const safeText = ref.serverName ? `in ${makeTextSafeForTooltip(ref.serverName)}` : "on Discord"
        const linkedText = `[[Link to message]](${ref.url} "${safeText}")`
        resultParts.push(linkedText)
        currentIndex = match.end
      }

      if (ref.serverName && ref.serverJoinURL) {
        resultParts.push(` ([Join ${ref.serverName}](${ref.serverJoinURL}))`)
      }
    } else if (ref.type === ReferenceType.USER_MENTION) {
      if (hyperlink) {
        resultParts.push(text.slice(hyperlink.start, hyperlink.end))
        currentIndex = hyperlink.end
      } else {
        const textContent = getAuthorName(ref.user) || "Unknown User"
        resultParts.push(`[@${textContent}](# "ID: ${ref.user.id}")`)
        currentIndex = match.end
      }
    } else if (ref.type === ReferenceType.CHANNEL_MENTION) {
      if (hyperlink) {
        resultParts.push(text.slice(hyperlink.start, hyperlink.end))
        currentIndex = hyperlink.end
      } else if (ref.channelName && ref.channelURL) {
        const linkedText = `[#${ref.channelName}](${ref.channelURL})`
        resultParts.push(linkedText)
        currentIndex = match.end
      } else {
        const linkedText = `[Unknown Channel](# "ID: ${ref.channelID}")`
        resultParts.push(linkedText)
        currentIndex = match.end
      }
    }
  }

  if (currentIndex < text.length) {
    resultParts.push(text.slice(currentIndex))
  }

  return { result: resultParts.join("") }
}
