import { notFound } from "next/navigation";
import { ArchiveShell } from "@/components/archive/ArchiveShell";
import { fetchArchiveIndex, fetchDictionaryIndex } from "@/lib/archive";
import { ARCHIVE_PAGE_SIZE, getArchivePageCount } from "@/lib/pagination";
import { disablePagination } from "@/lib/runtimeFlags";

export const dynamic = "force-static";

type Params = {
  params: { page: string };
};

export async function generateStaticParams() {
  if (disablePagination) return [];
  const archive = await fetchArchiveIndex();
  const pageCount = getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => ({ page: `${i + 2}` }));
}

export default async function ArchivePage({ params }: Params) {
  const pageNumber = Number.parseInt((await params).page, 10);
  if (!Number.isFinite(pageNumber) || pageNumber < 2) return notFound();
  const [archive, dictionary] = await Promise.all([fetchArchiveIndex(), fetchDictionaryIndex()]);
  const pageCount = getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
  if (pageNumber > pageCount) return notFound();
  return (
    <ArchiveShell
      initialArchive={archive}
      initialDictionary={dictionary}
      pageNumber={pageNumber}
      pageSize={ARCHIVE_PAGE_SIZE}
      pageCount={pageCount}
    />
  );
}
