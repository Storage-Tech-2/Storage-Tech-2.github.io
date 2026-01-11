import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { asyncPool, assetURL } from "../lib/github";
import { fetchArchiveIndex, fetchDictionaryIndex, fetchPostData, type ArchiveListItem } from "../lib/archive";
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO } from "../lib/types";
import { disablePreviewOptimization } from "../lib/runtimeFlags";

const owner = process.env.NEXT_PUBLIC_ARCHIVE_OWNER || DEFAULT_OWNER;
const repo = process.env.NEXT_PUBLIC_ARCHIVE_REPO || DEFAULT_REPO;
const branch = process.env.NEXT_PUBLIC_ARCHIVE_BRANCH || DEFAULT_BRANCH;
const skip = process.env.SKIP_PREVIEW_DOWNLOAD === "1";

const root = process.cwd();
const outputDir = path.join(root, "public", "previews");
const indexPath = path.join(root, "lib", "generated", "previews.json");

const MAX_WIDTH = Number.parseInt(process.env.PREVIEW_MAX_WIDTH || "1200", 10);
const QUALITY = Number.parseInt(process.env.PREVIEW_QUALITY || "80", 10);

async function main() {
  if (skip || disablePreviewOptimization) {
    // save empty index file
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(
      indexPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          items: [],
        },
        null,
        2,
      ),
    );
    console.log("Skipping preview download (SKIP_PREVIEW_DOWNLOAD=1).");
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(indexPath), { recursive: true });

  const archive = await fetchArchiveIndex(owner, repo, branch, "no-store");
  const posts: ArchiveListItem[] = archive.posts;
  const archiveIndexPath = path.join(root, "lib", "generated", "archive-index.json");
  await fs.writeFile(archiveIndexPath, JSON.stringify(archive, null, 2));

  const previews: Array<{
    id: string;
    slug: string;
    code: string;
    sourceUrl: string;
    localPath: string;
    width?: number;
    height?: number;
  }> = [];

  await asyncPool(6, posts, async (post) => {
    try {
      const data = await fetchPostData(post.channel.path, post.entry, owner, repo, branch, "no-store");
      const image = data.images?.[0];
      if (!image) return;
      const sourceUrl = image.path ? assetURL(post.channel.path, post.entry.path, image.path, owner, repo, branch) : image.url;
      if (!sourceUrl) return;

      const res = await fetch(sourceUrl);
      if (!res.ok) return;
      const buffer = Buffer.from(await res.arrayBuffer());

      const pipeline = sharp(buffer)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY });
      const metadata = await pipeline.metadata();
      const outBuffer = await pipeline.toBuffer();

      const filename = `${post.slug}.webp`;
      const outPath = path.join(outputDir, filename);
      await fs.writeFile(outPath, outBuffer);

      previews.push({
        id: post.entry.id,
        slug: post.slug,
        code: post.entry.code,
        sourceUrl,
        localPath: `/previews/${filename}`,
        width: metadata.width,
        height: metadata.height,
      });
    } catch {
      // ignore individual failures
    }
  });

  previews.sort((a, b) => a.slug.localeCompare(b.slug));
  const payload = { generatedAt: new Date().toISOString(), items: previews };
  await fs.writeFile(indexPath, JSON.stringify(payload, null, 2));
  const dictionaryIndex = await fetchDictionaryIndex(owner, repo, branch, "no-store");
  const dictionaryIndexPath = path.join(root, "lib", "generated", "dictionary-index.json");
  await fs.writeFile(dictionaryIndexPath, JSON.stringify(dictionaryIndex, null, 2));
  console.log(`Wrote ${previews.length} previews to ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
