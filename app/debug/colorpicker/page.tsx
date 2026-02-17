import type { Metadata } from "next";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { TagColorLab } from "./ColorWebLab";
import { siteConfig } from "@/lib/siteConfig";
import { PageJsonLd } from "@/components/seo/PageJsonLd";

const debugColorPickerTitle = `Tag color debugger · ${siteConfig.siteName}`;
const debugColorPickerDescription = "Preview how a colorWeb value will render on tag chips and pills. Debug-only; not indexed or linked.";

export const metadata: Metadata = {
  title: debugColorPickerTitle,
  description: debugColorPickerDescription,
  metadataBase: new URL(siteConfig.siteUrl),
  robots: {
    index: false,
    follow: false,
  },
};

export default function ColorPickerDebugPage() {
  return (
    <>
      <PageJsonLd
        path="/debug/colorpicker/"
        title={debugColorPickerTitle}
        description={debugColorPickerDescription}
      />
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-white">
        <HeaderBar siteName={siteConfig.siteName} view="home" logoSrc={siteConfig.logoSrc} discordInviteUrl={siteConfig.discordInviteUrl} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mb-6 max-w-3xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">Debug utility</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Tag colorWeb simulator</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This page is intentionally unlinked. Paste the URL directly to test how a <code>colorWeb</code> value affects tag pills and filter chips before committing a new global tag color.
          </p>
        </div>

        <TagColorLab />
      </main>

        <Footer />
      </div>
    </>
  );
}
