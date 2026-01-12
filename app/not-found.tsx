'use client';

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PostContent } from "@/components/archive/PostContent";
import { Footer } from "@/components/layout/Footer";
import {
  buildEntrySlug,
  fetchArchiveIndex,
  fetchDictionaryIndex,
  fetchPostData,
  findPostBySlug,
  type ArchiveListItem,
} from "@/lib/archive";
import { buildDictionarySlug, findDictionaryEntryBySlug } from "@/lib/dictionary";
import { disableLiveFetch } from "@/lib/runtimeFlags";
import { type ArchiveEntryData, type IndexedDictionaryEntry } from "@/lib/types";

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [post, setPost] = useState<ArchiveListItem | null>(null);
  const [data, setData] = useState<ArchiveEntryData | null>(null);
  const [dictionaryTooltips, setDictionaryTooltips] = useState<Record<string, string>>({});
  const [dictionaryEntry, setDictionaryEntry] = useState<IndexedDictionaryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const dictionaryIndexRef = useRef<IndexedDictionaryEntry[] | null>(null);
  const inflightDictionaryRef = useRef<Promise<IndexedDictionaryEntry[]> | null>(null);

  const archiveSlug = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/\/archives\/(.+)/);
    return match?.[1] ? decodeURIComponent(match[1].replace(/\/+$/, "")) : null;
  }, [pathname]);

  const dictionarySlug = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/\/dictionary\/(.+)/);
    return match?.[1] ? decodeURIComponent(match[1].replace(/\/+$/, "")) : null;
  }, [pathname]);

  useEffect(() => {
    const slug = archiveSlug ?? dictionarySlug;
    const kind = archiveSlug ? "archive" : dictionarySlug ? "dictionary" : null;
    if (!slug || !kind) {
      setHasResolved(true);
      setLoading(false);
      return;
    }
    if (disableLiveFetch) {
      setError("Live fetching is disabled.");
      setHasResolved(true);
      setLoading(false);
      return;
    }

    const requestKey = `${kind}:${slug.toLowerCase()}`;
    if (requestKeyRef.current === requestKey) return;
    requestKeyRef.current = requestKey;

    let cancelled = false;
    setHasResolved(false);
    setLoading(true);
    setError(null);
    setDictionaryEntry(null);
    setDictionaryTooltips({});
    if (kind === "archive") {
      setPost(null);
      setData(null);
    }

    const ensureDictionaryIndex = async () => {
      if (dictionaryIndexRef.current) return dictionaryIndexRef.current;
      if (inflightDictionaryRef.current) return inflightDictionaryRef.current;
      const promise = fetchDictionaryIndex(undefined, undefined, undefined, "no-store").then((dictionary) => {
        dictionaryIndexRef.current = dictionary.entries;
        return dictionary.entries;
      });
      inflightDictionaryRef.current = promise;
      try {
        return await promise;
      } finally {
        inflightDictionaryRef.current = null;
      }
    };

    async function run() {
      try {
        if (kind === "archive") {
          const archive = await fetchArchiveIndex(undefined, undefined, undefined, "no-store");
          if (cancelled || !slug) return;
          const found = findPostBySlug(archive.posts, slug);
          if (!found) {
            setError("We could not find this entry in the archive.");
            return;
          }
          const [postData, dictionaryEntries] = await Promise.all([
            fetchPostData(found.channel.path, found.entry, undefined, undefined, undefined, "no-store"),
            ensureDictionaryIndex(),
          ]);
          if (cancelled) return;
          const tooltips: Record<string, string> = {};
          dictionaryEntries.forEach((entry) => {
            const summary = entry.index.summary?.trim();
            if (summary) tooltips[entry.index.id] = summary;
          });
          setDictionaryTooltips(tooltips);
          setPost(found);
          setData(postData);
          const canonicalSlug = buildEntrySlug(found.entry);
          if (canonicalSlug && canonicalSlug !== slug) {
            const canonicalKey = `archive:${canonicalSlug.toLowerCase()}`;
            requestKeyRef.current = canonicalKey;
            router.replace(`/archives/${encodeURIComponent(canonicalSlug)}`);
          }
        } else {
          const dictionaryEntries = await ensureDictionaryIndex();
          if (cancelled || !slug) return;
          const entryIndex = findDictionaryEntryBySlug(
            dictionaryEntries.map((entry) => entry.index),
            slug,
          );
          if (!entryIndex) {
            setError("We could not find this dictionary entry.");
            return;
          }
          setDictionaryEntry({ index: entryIndex });
          const canonicalSlug = buildDictionarySlug(entryIndex);
          if (canonicalSlug && canonicalSlug !== slug) {
            const canonicalKey = `dictionary:${canonicalSlug.toLowerCase()}`;
            requestKeyRef.current = canonicalKey;
            router.replace(`/dictionary/${encodeURIComponent(canonicalSlug)}`);
          }
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Unable to load content.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasResolved(true);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [archiveSlug, dictionarySlug, router]);

  if (archiveSlug && post && data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-10 lg:px-6">
     
        <PostContent post={{ ...post, data }} data={data} dictionaryTooltips={dictionaryTooltips} />
      </main>
    );
  }

  const isArchivePath = Boolean(archiveSlug);
  const isDictionaryPath = Boolean(dictionarySlug);
  const lookupSlug = archiveSlug ?? dictionarySlug ?? "";
  const fallbackHref = dictionarySlug ? "/dictionary" : "/";
  const isChecking = (isArchivePath || isDictionaryPath) && !disableLiveFetch && (!hasResolved || loading);
  const showNotFound =
    !isChecking &&
    ((isArchivePath && (!post || !data)) || (isDictionaryPath && !dictionaryEntry) || (!isArchivePath && !isDictionaryPath) || Boolean(error));

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        {isChecking ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Looking for this page…</h1>
            <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
              Hold on while we check the {isArchivePath ? "archive" : "dictionary"} for{" "}
              <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{lookupSlug}</code>.
            </p>
          </>
        ) : showNotFound ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">404 – Page Not Found</h1>
            {lookupSlug ? (
              <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
                We looked for <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{lookupSlug}</code> in the{" "}
                {isArchivePath ? "archive" : "dictionary"} but could not render it.
                {error ? ` ${error}` : " Try again in a few moments."}
              </p>
            ) : (
              <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">The page you are looking for does not exist.</p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Found it</h1>
            <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
              We located this {isArchivePath ? "archive entry" : "dictionary entry"}. Redirecting you to the canonical page…
            </p>
          </>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            Go back
          </button>
          <Link
            href={fallbackHref}
            prefetch={false}
            className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
          >
            {dictionarySlug ? "Back to dictionary" : "Back to archive"}
          </Link>
        </div>
        {isChecking ? (
          <p className="text-xs text-gray-500">
            {isArchivePath ? "Checking for a newer archive entry…" : "Checking for a matching dictionary entry…"}
          </p>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
