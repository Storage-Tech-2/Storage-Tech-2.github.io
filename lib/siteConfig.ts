export type SiteConfig = {
  siteName: string;
  logoSrc: string;
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
  archiveRepo: {
    owner: "Storage-Tech-2",
    repo: "Archive",
    branch: "main",
  },
  repositoryUrl: "https://github.com/Storage-Tech-2/Archive",
  discordInviteUrl: "https://discord.gg/hztJMTsx2m",
};
