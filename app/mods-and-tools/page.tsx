import Image from "next/image";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { siteConfig } from "@/lib/siteConfig";
import type { Metadata } from "next";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { createCollectionPageJsonLd } from "@/lib/jsonLd";

const modsAndToolsTitle = `Mods and tools · ${siteConfig.siteName}`;
const modsAndToolsDescription = "Recommendations for storage tech mods, tools, and resource packs that make building easier.";

export const metadata: Metadata = {
  title: modsAndToolsTitle,
  description: modsAndToolsDescription,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: modsAndToolsTitle,
    description: modsAndToolsDescription,
    url: `/mods-and-tools/`,
    images: [
      {
        url: `/mods/st2downloader.png`
      },
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: modsAndToolsTitle,
    description: modsAndToolsDescription,
    images: ["/mods/st2downloader.png"]
  },
};

const resources = [
  {
    title: "Archive Downloader",
    description:
      "A mod that allows you to browse and download Storage Tech 2 and other technical archives directly in-game.",
    url: "https://github.com/Llama-Collective/Archive-Downloader",
    imageSrc: "/mods/st2downloader.png",
    imageAlt: "Archive Downloader preview",
  },
  {
    title: "Redstone Multimeter",
    description:
      "A mod that logs and visualizes redstone timings to help debug complex builds.",
    url: "https://modrinth.com/mod/redstone-multimeter",
    imageSrc: "/mods/rsmmguide.png",
    imageAlt: "Redstone Multimeter preview",
  },
];

const modsAndToolsJsonLd = createCollectionPageJsonLd({
  path: "/mods-and-tools/",
  title: modsAndToolsTitle,
  description: modsAndToolsDescription,
  imagePath: "/mods/st2downloader.png",
  items: resources.map((resource) => ({
    name: resource.title,
    description: resource.description,
    url: resource.url,
    type: "SoftwareApplication",
    imagePath: resource.imageSrc,
    extra: {
      applicationCategory: "GameUtilityApplication",
    },
  })),
});

export default function ModsAndToolsPage() {
  return (
    <>
      <PageJsonLd data={modsAndToolsJsonLd} />
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
        <HeaderBar
          siteName={siteConfig.siteName}
          view="home"
          logoSrc={siteConfig.logoSrc}
          discordInviteUrl={siteConfig.discordInviteUrl}
        />

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Mods & tools
          </p>
          <h1 className="text-3xl font-semibold">Mods that help you build better storage tech</h1>
          <p className="text-base text-gray-700 dark:text-gray-200">
            These are the mods and tools we recommend to help you design, test, and manage your storage tech builds more effectively.
          </p>
        </section>

        <section className="space-y-6">
          {resources.map((resource) => (
            <article
              key={resource.title}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
            >
              <div className="relative h-48 w-full">
                <Image
                  src={resource.imageSrc}
                  alt={resource.imageAlt}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
              <div className="flex flex-col gap-3 px-5 py-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">{resource.title}</h2>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-sky-600 transition hover:text-sky-500"
                  >
                    Open resource
                  </a>
                </div>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{resource.description}</p>
              </div>
            </article>
          ))}
        </section>
      </main>

        <Footer />
      </div>
    </>
  );
}
