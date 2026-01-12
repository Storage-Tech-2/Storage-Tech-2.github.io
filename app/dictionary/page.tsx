import { DictionaryPageClient } from "@/components/dictionary/DictionaryPageClient";
import { fetchDictionaryIndex } from "@/lib/archive";

export const dynamic = "force-static";

export default async function DictionaryPage() {
  const dictionary = await fetchDictionaryIndex();
  return <DictionaryPageClient entries={dictionary.entries}/>;
}
