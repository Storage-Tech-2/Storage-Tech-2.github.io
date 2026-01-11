'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PostContent } from "@/components/archive/PostContent";
import { Footer } from "@/components/layout/Footer";
import {
  buildEntrySlug,
  fetchArchiveConfig,
  fetchChannelData,
  fetchDictionaryIndex,
  fetchPostData,
  findPostBySlug,
  type ArchiveListItem,
} from "@/lib/archive";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { type ArchiveEntryData } from "@/lib/types";

export default function NotFound() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<ArchiveListItem | null>(null);
  const [data, setData] = useState<ArchiveEntryData | null>(null);
  const [dictionaryTooltips, setDictionaryTooltips] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const archiveSlug = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/\/archives\/(.+)/);
    return match?.[1] ? decodeURIComponent(match[1].replace(/\/+$/, "")) : null;
  }, [pathname]);

  useEffect(() => {
    if (!archiveSlug) return;
    if (disableLiveFetch) return;
    const slug = archiveSlug;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const entryCode = slug.split("-")[0];
        const config = await fetchArchiveConfig(undefined, undefined, undefined, "no-store");
        if (cancelled) return;
        const channels = config.archiveChannels || [];
        const channel = channels.find((ch) => entryCode.startsWith(ch.code));
        if (!channel) {
          setError("We could not match this entry to a channel.");
          setPost(null);
          setData(null);
          return;
        }
        const channelData = await fetchChannelData(channel.path, undefined, undefined, undefined, "no-store");
        if (cancelled) return;
        const posts: ArchiveListItem[] = (channelData.entries || []).map((entry) => ({
          channel,
          entry,
          slug: buildEntrySlug(entry),
        }));
        const found = findPostBySlug(posts, slug);
        if (!found) {
          setError("We could not find this entry in the archive.");
          setPost(null);
          setData(null);
          return;
        }
        const [postData, dictionary] = await Promise.all([
          fetchPostData(found.channel.path, found.entry, undefined, undefined, undefined, "no-store"),
          fetchDictionaryIndex(undefined, undefined, undefined, "no-store"),
        ]);
        if (cancelled) return;
        const tooltips: Record<string, string> = {};
        dictionary.entries.forEach((entry) => {
          const summary = entry.index.summary?.trim();
          if (summary) tooltips[entry.index.id] = summary;
        });
        setDictionaryTooltips(tooltips);
        setPost(found);
        setData(postData);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Unable to load archive data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [archiveSlug]);

  if (archiveSlug && post && data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-10 lg:px-6">
        <div className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-100">
          This entry was loaded dynamically from GitHub because it was added after the last static build.
        </div>
        <PostContent post={{ ...post, data }} data={data} dictionaryTooltips={dictionaryTooltips} />
      </main>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">404 – Page Not Found</h1>
        {archiveSlug ? (
          <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
            We looked for <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{archiveSlug}</code> in the archive but could not render it.
            {error ? ` ${error}` : " Try again in a few moments."}
          </p>
        ) : (
          <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">The page you are looking for does not exist.</p>
        )}
        <Link href="/" prefetch={false} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
          Back to archive
        </Link>
        {loading ? <p className="text-xs text-gray-500">Checking for a newer archive entry…</p> : null}
      </main>
      <Footer />
    </>
  );
}
