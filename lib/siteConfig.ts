export type SiteConfig = {
  lfsExtensions: string[];
  siteName: string;
  siteDescription: string;
  logoSrc: string;
  basePath: string;
  assetPrefix?: string;
  siteOrigin: string;
  siteUrl: string;
  archiveRepo: {
    owner: string;
    repo: string;
    branch: string;
  };
  discordInviteUrl?: string;
  repositoryUrl?: string;
};

const normalizeBasePath = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailing = withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
  return withoutTrailing;
};

// Deployment configuration lives here rather than env variables.
const siteOrigin = "https://storagetech2.org";
// Set to "/viewer" (or "" for root) depending on where the site is hosted.
const basePath = normalizeBasePath("");
const assetPrefix = basePath || undefined;
const siteUrl = `${siteOrigin.replace(/\/+$/, "")}${basePath || ""}`;

export const siteConfig: SiteConfig = {
  siteName: "Storage Tech 2",
  siteDescription: "The best resource for Minecraft storage tech. 200+ schematics, community spaces, and tools to help you make your own storage system. Check out our archive of tech and join us today!",
  logoSrc: "/logo.png",
  basePath,
  assetPrefix,
  siteOrigin,
  siteUrl,
  archiveRepo: {
    owner: "Storage-Tech-2",
    repo: "Archive",
    branch: "main",
  },
  lfsExtensions: ["mp4", "bin", "zip"],
  repositoryUrl: "https://github.com/Storage-Tech-2/Archive",
  discordInviteUrl: "https://discord.gg/storage-tech-2-1375556143186837695",
};
