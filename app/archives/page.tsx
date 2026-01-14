import { ArchiveShell } from "@/components/archive/ArchiveShell";
import { fetchArchiveIndex, fetchDictionaryIndex } from "@/lib/archive";
import { ARCHIVE_PAGE_SIZE, getArchivePageCount } from "@/lib/pagination";
import { disablePagination } from "@/lib/runtimeFlags";

export const dynamic = "force-static";

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
