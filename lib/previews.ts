const fallbackIndex: PreviewIndex = { generatedAt: "", items: [] };
let previewIndex: PreviewIndex = fallbackIndex;
try {
  // "./generated/previews.json"
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  previewIndex = require("../generated/previews.json") as PreviewIndex;
} catch {
  previewIndex = fallbackIndex;
}

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

const byId = new Map(previewIndex.items.map((item) => [item.id, item]));
const bySlug = new Map(previewIndex.items.map((item) => [item.slug, item]));

export function getPreviewByEntryId(id?: string | null) {
  if (!id) return undefined;
  return byId.get(id);
}

export function getPreviewBySlug(slug?: string | null) {
  if (!slug) return undefined;
  return bySlug.get(slug);
}
