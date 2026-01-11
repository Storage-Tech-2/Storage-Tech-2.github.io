'use client';

import { siteConfig } from "@/lib/siteConfig";

export function Footer() {
  return (
    <footer className="border-t py-6 text-center text-xs text-gray-500 dark:text-gray-400">
      Built for the {siteConfig.siteName} archive. See the code on{" "}
      <a href="https://github.com/Storage-Tech-2/Storage-Tech-2.github.io" className="underline">
        Github
      </a>
      .
    </footer>
  );
}
