import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostContent } from "@/components/archive/PostContent";
import { PostNav } from "@/components/archive/PostNav";
import { Footer } from "@/components/layout/Footer";
import { fetchArchiveIndex, fetchDictionaryIndex, fetchPostData, findPostBySlug } from "@/lib/archive";
import { getPreviewBySlug } from "@/lib/previews";
import { siteConfig } from "@/lib/siteConfig";
import { disableArchivePrerender } from "@/lib/runtimeFlags";

export const dynamic = "force-static";

type Params = {
  params: { slug: string };
};

export async function generateStaticParams() {
  if (disableArchivePrerender) return [
    { slug: "example-entry" },
  ];
  const archive = await fetchArchiveIndex();
  return archive.posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const archive = await fetchArchiveIndex();
  const match = findPostBySlug(archive.posts, decodeURIComponent((await params).slug));
  if (!match) return { title: "Entry not found" };
  const preview = getPreviewBySlug(match.slug);
  const ogImage = preview ? new URL(preview.localPath, siteConfig.siteUrl).toString() : undefined;
  const description = `Archive entry ${match.entry.code} from ${match.channel.name}`;
  return {
    title: `${match.entry.name} | ${siteConfig.siteName}`,
    description,
    alternates: {
      canonical: `/archives/${match.slug}`,
    },
    openGraph: {
      type: "article",
      title: `${match.entry.name} | ${siteConfig.siteName}`,
      description,
      url: `/archives/${match.slug}`,
      images: ogImage
        ? [
            {
              url: ogImage,
              width: preview?.width,
              height: preview?.height,
              alt: match.entry.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: `${match.entry.name} | ${siteConfig.siteName}`,
      description,
      images: ogImage ? [ogImage] : undefined,
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
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-10 lg:px-6">
        <PostNav />
        <PostContent post={{ ...match, data }} data={data} schemaStyles={archive.config.postStyle} dictionaryTooltips={dictionaryTooltips} />
      </main>
      <Footer />
    </>
  );
}
