'use client';

import { PostContent } from "./PostContent";
import { PostNav } from "./PostNav";
import { Footer } from "@/components/layout/Footer";
import type { ArchiveConfig, ArchiveEntryData, GlobalTag } from "@/lib/types";
import type { ArchiveListItem } from "@/lib/archive";

type Props = {
  post: ArchiveListItem | null;
  data: ArchiveEntryData | null;
  dictionaryTooltips: Record<string, string>;
  loading: boolean;
  error: string | null;
  globalTags: GlobalTag[];
  archiveConfig: ArchiveConfig;
  onClose(): void;
  onArchiveNavigate(url: URL): boolean;
};

export function ArchivePostView({
  post,
  data,
  dictionaryTooltips,
  error,
  globalTags,
  archiveConfig,
  onClose,
  onArchiveNavigate,
}: Props) {
  if (!post) return null;

  return (
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-8 lg:px-6">
        <PostNav onBack={onClose} onHome={onClose} />
     
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <PostContent
          key={post.entry.id}
          post={post}
          data={data || undefined}
          schemaStyles={archiveConfig.postStyle}
          dictionaryTooltips={dictionaryTooltips}
          globalTags={globalTags}
          onArchiveNavigate={onArchiveNavigate}
        />
      </main>
      <Footer />
    </>
  );
}
