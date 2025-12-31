import { type IndexedPost } from "../types"
import { normalize } from "./strings"
import { unique } from "./arrays"

// Collect normalized tag names for a post from entry ref and loaded data
export function getPostTagsNormalized(p: IndexedPost): string[] {
  const entryTags = p.entry?.tags || []
  const loadedTags = p.data?.tags?.map(t => t.name) || []
  return unique([...entryTags, ...loadedTags]).map(normalize)
}
