import { DictionaryPageClient } from "@/components/dictionary/DictionaryPageClient";
import { fetchDictionaryIndex } from "@/lib/archive";
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO } from "@/lib/types";

export const dynamic = "force-static";

export default async function DictionaryPage() {
  const dictionary = await fetchDictionaryIndex(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH);
  return <DictionaryPageClient entries={dictionary.entries} owner={DEFAULT_OWNER} repo={DEFAULT_REPO} branch={DEFAULT_BRANCH} />;
}
