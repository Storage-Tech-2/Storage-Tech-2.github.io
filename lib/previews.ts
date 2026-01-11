const fallbackIndex: PreviewIndex = { generatedAt: "", items: [] };
let previewIndex: PreviewIndex = fallbackIndex;
try {
  // Avoid hard build-time dependency on the JSON file.
  // eslint-disable-next-line no-eval
  const req = eval("require") as (path: string) => unknown;
  previewIndex = (req("./generated/previews.json") as PreviewIndex) ?? fallbackIndex;
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
