import { DictionaryPageClient } from "@/components/dictionary/DictionaryPageClient";
import { fetchDictionaryIndex } from "@/lib/archive";
import { buildDictionarySlug } from "@/lib/dictionary";
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO } from "@/lib/types";
import { disableDictionaryPrerender } from "@/lib/runtimeFlags";

export const dynamic = "force-static";

type Params = {
  params: { slug: string };
};

export async function generateStaticParams() {
  if (disableDictionaryPrerender) return [
    { slug: "example-entry" },
  ];
  const dictionary = await fetchDictionaryIndex(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH);
  return dictionary.entries.map((entry) => ({ slug: buildDictionarySlug(entry.index) }));
}

export default async function DictionaryEntryPage(_params: Params) {
  const dictionary = await fetchDictionaryIndex(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH);
  return <DictionaryPageClient entries={dictionary.entries} owner={DEFAULT_OWNER} repo={DEFAULT_REPO} branch={DEFAULT_BRANCH} />;
}
