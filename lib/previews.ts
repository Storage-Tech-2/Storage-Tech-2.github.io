// "../generated/previews.json"
import previewIndex from "./generated/previews.json";

export type PreviewItem = {
  id: string;
  slug: string;
  code: string;
  sourceUrl: string;
  localPath: string;
  width?: number;
  height?: number;
};

export type PreviewIndex = {
  generatedAt: string;
  items: PreviewItem[];
};

const previewIndexTyped: PreviewIndex = previewIndex as PreviewIndex;

const byId = new Map(previewIndexTyped.items.map((item) => [item.id, item]));
const bySlug = new Map(previewIndexTyped.items.map((item) => [item.slug, item]));

export function getPreviewByEntryId(id?: string | null) {
  if (!id) return undefined;
  return byId.get(id);
}

export function getPreviewBySlug(slug?: string | null) {
  if (!slug) return undefined;
  return bySlug.get(slug);
}
