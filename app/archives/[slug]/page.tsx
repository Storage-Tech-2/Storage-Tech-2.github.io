import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostContent } from "@/components/archive/PostContent";
import { PostNav } from "@/components/archive/PostNav";
import { fetchArchiveIndex, fetchDictionaryIndex, fetchPostData, findPostBySlug } from "@/lib/archive";
import { siteConfig } from "@/lib/siteConfig";

export const dynamic = "force-static";

type Params = {
  params: { slug: string };
};

export async function generateStaticParams() {
  const archive = await fetchArchiveIndex();
  return archive.posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const archive = await fetchArchiveIndex();
  const match = findPostBySlug(archive.posts, decodeURIComponent((await params).slug));
  if (!match) return { title: "Entry not found" };
  return {
    title: `${match.entry.name} | ${siteConfig.siteName}`,
    description: `Archive entry ${match.entry.code} from ${match.channel.name}`,
    openGraph: {
      title: `${match.entry.name} | ${siteConfig.siteName}`,
      description: `Archive entry ${match.entry.code} from ${match.channel.name}`,
      url: `/archives/${match.slug}`,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const slug = decodeURIComponent((await params).slug);
  const archive = await fetchArchiveIndex();
  const match = findPostBySlug(archive.posts, slug);
  if (!match) return notFound();

  const data = await fetchPostData(match.channel.path, match.entry);
  const dictionary = await fetchDictionaryIndex();
  const dictionaryTooltips: Record<string, string> = {};
  dictionary.entries.forEach((entry) => {
    const summary = entry.index.summary?.trim();
    if (summary) dictionaryTooltips[entry.index.id] = summary;
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-10 lg:px-6">
      <PostNav />
      <PostContent post={{ ...match, data }} data={data} schemaStyles={archive.config.postStyle} dictionaryTooltips={dictionaryTooltips} />
    </main>
  );
}
