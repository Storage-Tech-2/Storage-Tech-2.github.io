export type SiteConfig = {
  siteName: string;
  logoSrc: string;
  siteUrl: string;
  archiveRepo: {
    owner: string;
    repo: string;
    branch: string;
  };
  discordInviteUrl?: string;
  repositoryUrl?: string;
};

export const siteConfig: SiteConfig = {
  siteName: "Storage Tech 2",
  logoSrc: "/logo.png",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://storagetech2.org",
  archiveRepo: {
    owner: "Storage-Tech-2",
    repo: "Archive",
    branch: "main",
  },
  repositoryUrl: "https://github.com/Storage-Tech-2/Archive",
  discordInviteUrl: "https://discord.gg/hztJMTsx2m",
};
