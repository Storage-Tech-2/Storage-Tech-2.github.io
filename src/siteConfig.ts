import logoimg from "./assets/logo.png";

export type SiteConfig = {
  siteName: string;
  logoSrc: string;
  archiveRepo: {
    owner: string;
    repo: string;
    branch: string;
  };
  discordInviteUrl?: string;
};

export const siteConfig: SiteConfig = {
  siteName: "Storage Tech 2",
  logoSrc: logoimg,
  archiveRepo: {
    owner: "Storage-Tech-2",
    repo: "Archive",
    branch: "main",
  },
  discordInviteUrl: "https://discord.gg/hztJMTsx2m",
};
