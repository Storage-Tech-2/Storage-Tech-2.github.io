import { ArchiveShell } from "@/components/archive/ArchiveShell";
import { fetchArchiveIndex, fetchDictionaryIndex } from "@/lib/archive";
import { ARCHIVE_PAGE_SIZE, getArchivePageCount } from "@/lib/pagination";
import { disablePagination } from "@/lib/runtimeFlags";
import { siteConfig } from "@/lib/siteConfig";
import { Metadata } from "next";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {

  const description = "Explore the archives for storage designs, guides, and resources submitted by the community.";
  return {
    title: `Archives · ${siteConfig.siteName}`,
    description,
    metadataBase: new URL(siteConfig.siteUrl),
    alternates: {
      canonical: `/archives`,
    },
    openGraph: {
      title: `Archives · ${siteConfig.siteName}`,
      description,
      url: `/archives`,
      images: [
        {
          url: `/archive.webp`
        },
      ]
    },
    twitter: {
      card: "summary",
      title: `Archives · ${siteConfig.siteName}`,
      description,
      images: ["/archive.webp"],
    },
  };
}

export default async function ArchivePage() {
  const [archive, dictionary] = await Promise.all([fetchArchiveIndex(), fetchDictionaryIndex()]);
  const pageCount = disablePagination ? 1 : getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
  return (
    <ArchiveShell
      initialArchive={archive}
      initialDictionary={dictionary}
      pageNumber={0}
      pageSize={ARCHIVE_PAGE_SIZE}
      pageCount={pageCount}
    />
  );
}
