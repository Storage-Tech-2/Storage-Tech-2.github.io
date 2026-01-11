import { ArchiveShell } from "@/components/archive/ArchiveShell";
import { fetchArchiveIndex, fetchDictionaryIndex } from "@/lib/archive";

export const dynamic = "force-static";

export default async function Home() {
  const [archive, dictionary] = await Promise.all([fetchArchiveIndex(), fetchDictionaryIndex()]);
  return <ArchiveShell initialArchive={archive} initialDictionary={dictionary} />;
}
