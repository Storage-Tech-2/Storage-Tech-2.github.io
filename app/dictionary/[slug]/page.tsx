import type { Metadata } from "next";
import { DictionaryPageClient } from "@/components/dictionary/DictionaryPageClient";
import { fetchDictionaryIndex } from "@/lib/archive";
import { buildDictionarySlug, findDictionaryEntryBySlug } from "@/lib/dictionary";
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO } from "@/lib/types";
import { disableDictionaryPrerender } from "@/lib/runtimeFlags";
import { siteConfig } from "@/lib/siteConfig";

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

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug);
  const dictionary = await fetchDictionaryIndex(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH);
  const match = findDictionaryEntryBySlug(dictionary.config.entries, slug);
  if (!match) {
    return { title: "Entry not found" };
  }

  const description =
    match.summary?.trim().slice(0, 160) ||
    `Dictionary entry ${match.id} from ${siteConfig.siteName}`;
  const title = `${match.terms?.[0] ?? match.id} | ${siteConfig.siteName} Dictionary`;

  return {
    title,
    description,
    alternates: {
      canonical: `/dictionary/${slug}`,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/dictionary/${slug}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function DictionaryEntryPage(_params: Params) {
  const dictionary = await fetchDictionaryIndex(DEFAULT_OWNER, DEFAULT_REPO, DEFAULT_BRANCH);
  return <DictionaryPageClient entries={dictionary.entries} owner={DEFAULT_OWNER} repo={DEFAULT_REPO} branch={DEFAULT_BRANCH} />;
}
