'use client';

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { Footer } from "@/components/layout/Footer";

type NotFoundKind = "archive" | "dictionary";

const extractSlug = (pathname: string | null, segment: string) => {
  if (!pathname) return null;
  const match = pathname.match(new RegExp(`/${segment}/(.+)`));
  if (!match?.[1]) return null;
  const trimmed = match[1].replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
};

const resolveKindAndSlug = (pathname: string | null) => {
  const archiveSlug = extractSlug(pathname, "archives");
  if (archiveSlug) return { kind: "archive" as const, slug: archiveSlug };
  const dictionarySlug = extractSlug(pathname, "dictionary");
  if (dictionarySlug) return { kind: "dictionary" as const, slug: dictionarySlug };
  return { kind: null, slug: null };
};

function NotFoundResolverFallback() {
  const pathname = usePathname();
  const { kind, slug } = useMemo(() => resolveKindAndSlug(pathname), [pathname]);
  if (kind && slug) {
    return <PendingLookup kind={kind} slug={slug} />;
  }
  return <GenericNotFound />;
}

const NotFoundResolver = dynamic(() => import("./NotFoundResolver"), {
  ssr: false,
  loading: () => <NotFoundResolverFallback />,
});

function PendingLookup({ kind, slug }: { kind: NotFoundKind; slug: string }) {
  const fallbackHref = kind === "dictionary" ? "/dictionary" : "/archives";
  const handleBack = useBackNavigation(fallbackHref);
  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Looking for this page…</h1>
        <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">
          Hold on while we check the {kind === "archive" ? "archive" : "dictionary"} for{" "}
          <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{slug}</code>.
        </p>
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
            {kind === "dictionary" ? "Back to dictionary" : "Back to archive"}
          </Link>
        </div>
        <p className="text-xs text-gray-500">
          {kind === "archive" ? "Checking for a newer archive entry…" : "Checking for a matching dictionary entry…"}
        </p>
      </main>
      <Footer />
    </>
  );
}

function GenericNotFound() {
  const fallbackHref = "/";
  const handleBack = useBackNavigation(fallbackHref);
  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">404 – Page Not Found</h1>
        <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300">The page you are looking for does not exist.</p>
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
            Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function NotFoundClient() {
  const pathname = usePathname();
  const { kind, slug } = useMemo(() => resolveKindAndSlug(pathname), [pathname]);

  if (kind && slug) {
    return <NotFoundResolver kind={kind} slug={slug} />;
  }

  return <GenericNotFound />;
}
