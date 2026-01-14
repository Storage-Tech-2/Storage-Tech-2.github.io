import { DictionaryPageClient } from "@/components/dictionary/DictionaryPageClient";
import { fetchDictionaryIndex } from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";
import { Metadata } from "next";

export const dynamic = "force-static";


export const metadata: Metadata = {
  title: `Dictionary · ${siteConfig.siteName}`,
  description: "A comprehensive dictionary of storage tech terms and concepts.",
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: `Dictionary · ${siteConfig.siteName}`,
    description: "A comprehensive dictionary of storage tech terms and concepts.",
    url: `/dictionary`,
    images: []
  },
  twitter: {
    card: "summary",
    title: `Dictionary · ${siteConfig.siteName}`,
    description: "A comprehensive dictionary of storage tech terms and concepts.",
    images: []
  },
};

export default async function DictionaryPage() {
  const dictionary = await fetchDictionaryIndex();
  return <DictionaryPageClient entries={dictionary.entries}/>;
}
