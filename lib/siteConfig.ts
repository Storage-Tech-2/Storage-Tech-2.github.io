export type SiteConfig = {
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
const basePath = normalizeBasePath("/viewer");
const assetPrefix = basePath || undefined;
const siteUrl = `${siteOrigin.replace(/\/+$/, "")}${basePath || ""}`;

export const siteConfig: SiteConfig = {
  siteName: "Storage Tech 2",
  siteDescription: "A community-run platform to make Minecraft storage technologies accessible to everyone. Resources, community spaces, and tools to help you learn and develop storage technologies in Minecraft. Check out our archive of tech and join us today!",
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
  repositoryUrl: "https://github.com/Storage-Tech-2/Archive",
  discordInviteUrl: "https://discord.gg/hztJMTsx2m",
};
