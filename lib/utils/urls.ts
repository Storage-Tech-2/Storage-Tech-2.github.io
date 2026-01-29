import { siteConfig } from "@/lib/siteConfig";

type ArchiveSlugInfo = {
  slug: string | null;
  isArchiveRoot: boolean;
};

export function getArchiveSlugInfo(url: URL, basePath: string = siteConfig.basePath || ""): ArchiveSlugInfo {
  const rawPath = url.pathname;
  const normalizedPath = basePath && rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath;
  if (!normalizedPath.startsWith("/archives/")) {
    return { slug: null, isArchiveRoot: false };
  }
  const slugSegment = normalizedPath.replace("/archives/", "").replace(/\/+$/, "");
  if (!slugSegment) {
    return { slug: null, isArchiveRoot: true };
  }
  try {
    return { slug: decodeURIComponent(slugSegment), isArchiveRoot: false };
  } catch {
    return { slug: slugSegment, isArchiveRoot: false };
  }
}
