import { ArchiveShell } from "@/components/archive/ArchiveShell";
import { fetchArchiveIndex, fetchDictionaryIndex } from "@/lib/archive";
import { ARCHIVE_PAGE_SIZE, getArchivePageCount } from "@/lib/pagination";

export const dynamic = "force-static";

export default async function Home() {
  const [archive, dictionary] = await Promise.all([fetchArchiveIndex(), fetchDictionaryIndex()]);
  const pageCount = getArchivePageCount(archive.posts.length, ARCHIVE_PAGE_SIZE);
  return (
    <ArchiveShell
      initialArchive={archive}
      initialDictionary={dictionary}
      pageNumber={1}
      pageSize={ARCHIVE_PAGE_SIZE}
      pageCount={pageCount}
    />
  );
}
