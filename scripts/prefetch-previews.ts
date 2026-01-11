import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { asyncPool, assetURL } from "../lib/github";
import { buildEntrySlug, fetchArchiveConfig, fetchChannelData, fetchPostData } from "../lib/archive";
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO, type ChannelRef, type EntryRef } from "../lib/types";

type PostRef = {
  channel: ChannelRef;
  entry: EntryRef;
  slug: string;
};

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
  if (skip) {
    console.log("Skipping preview download (SKIP_PREVIEW_DOWNLOAD=1).");
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(indexPath), { recursive: true });

  const config = await fetchArchiveConfig(owner, repo, branch, "no-store");
  const channels = config.archiveChannels || [];

  const channelDatas = await asyncPool(6, channels, async (channel) => {
    try {
      const data = await fetchChannelData(channel.path, owner, repo, branch, "no-store");
      return { channel, data };
    } catch {
      return { channel, data: { ...channel, currentCodeId: 0, entries: [] } };
    }
  });

  const posts: PostRef[] = [];
  channelDatas.forEach(({ channel, data }) => {
    (data.entries || []).forEach((entry) => {
      posts.push({ channel, entry, slug: buildEntrySlug(entry) });
    });
  });

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
  console.log(`Wrote ${previews.length} previews to ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
