import { type ArchiveListItem } from "../archive";
import { unique } from "./arrays";
import { normalize } from "./strings";

export function getPostTagsNormalized(p: ArchiveListItem): string[] {
  const entryTags = p.entry?.tags || [];
  const loadedTags = p.data?.tags?.map((t) => t.name) || [];
  return unique([...entryTags, ...loadedTags]).map(normalize);
}
