import type { Metadata } from "next";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { createFaqPageJsonLd } from "@/lib/jsonLd";
import { siteConfig } from "@/lib/siteConfig";

const faqTitle = `FAQ · ${siteConfig.siteName}`;
const faqDescription = "Answers to common questions about Minecraft storage tech, how the Storage Catalog works, and where to find help in the community.";

type FaqLink = {
  label: string;
  href: string;
  external?: boolean;
};

type FaqItem = {
  question: string;
  answer: string;
  links?: FaqLink[];
};

const faqItems: FaqItem[] = [
  {
    question: "What is the Storage Catalog?",
    answer:
      "Storage Catalog is a community-maintained hub for Minecraft storage tech. It includes a searchable archive of builds, documentation, and a dictionary of technical terms.",
  },
  {
    question: "Where can I find a storage system?",
    answer:
      "You can find storage system designs in the Full Systems category of the archive. If you need something specific, use the search and filters to narrow down what you need.",
    links: [
      { label: "Browse the archive", href: "/archives" },
    ],
  },
    {
    question: "What is the best storage design?",
    answer:
      "There is no single 'best' design, the optimal storage system depends on your specific needs. The archive includes a variety of designs with different trade-offs to suit different use cases. Choose what works best for you, and feel free to ask for recommendations in the Discord community!",
  },
  {
    question: "Where can I ask for help with storage tech?",
    answer:
      "Join the Storage Catalog Discord for design help, troubleshooting, and feedback from community members and staff.",
    links: [
      { label: "Join Discord", href: siteConfig.discordInviteUrl ?? "#", external: true },
    ],
  },
  {
    question: "How can I submit my own storage tech designs to the archive?",
    answer:
      "You can submit your designs through our Discord. Look for the #submissions channel and follow the instructions sent by the bot.",
    links: [
      { label: "Open Discord", href: siteConfig.discordInviteUrl ?? "#", external: true },
    ],
  },
  {
    question: "Can beginners use this site?",
    answer:
      "Yes. The site is designed for all skill levels, with beginner-friendly explanations in the dictionary and progressively advanced archive entries.",
  },
  {
    question: "How often is the archive updated?",
    answer:
      "The archive is updated regularly as new designs are submitted and reviewed by the community. Check back often for the latest storage tech innovations!",
  },
  {
    question: "Is there a way to browse the archive in-game?",
    answer:
      "Yes! You can use the Archive Downloader mod to browse and download archive entries directly in Minecraft. It's available on our Mods and Tools page.",
    links: [
      { label: "Archive Downloader Mod on Modrinth", href: "https://modrinth.com/mod/archive-downloader", external: true },
      { label: "On CurseForge", href: "https://www.curseforge.com/minecraft/mc-mods/archive-downloader", external: true },
      { label: "Mods and Tools page", href: "/mods-and-tools" },
    ],
  },
  {
    question: "I want to use Storage Catalog data for my own projects, is there an API?",
    answer:
      "No API is necessary! All the data is available on our GitHub repository, which you can access through the link below. This website is built on top of that same data, so you can be confident that it's complete and up-to-date.",
    links: [
      { label: "Archive GitHub Repository", href: siteConfig.repositoryUrl ?? "#", external: true },
    ],
  },
  {
    question: "How can I contribute to the project?",
    answer:
      "Contributions are welcome! You can contribute by submitting storage tech designs, providing feedback in the Discord, or contributing code and improvements to the Llama Collective, a group of volunteers who maintain archive infrastructure and build community tools. Check out the links below to get involved.",
    links: [
      { label: "Join the Discord", href: siteConfig.discordInviteUrl ?? "#", external: true },
      { label: "Llama Collective", href: "https://llamamc.org/", external: true },
    ],
  }
];

const faqJsonLd = createFaqPageJsonLd({
  path: "/faq",
  title: faqTitle,
  description: faqDescription,
  imagePath: "/social.png",
  items: faqItems,
});

export const metadata: Metadata = {
  title: faqTitle,
  description: faqDescription,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: faqTitle,
    description: faqDescription,
    url: "/faq",
    images: [{ url: "/social.png" }],
  },
  twitter: {
    card: "summary",
    title: faqTitle,
    description: faqDescription,
    images: ["/social.png"],
  },
};

export default function FaqPage() {
  return (
    <>
      <PageJsonLd data={faqJsonLd} />
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
        <HeaderBar
          siteName={siteConfig.siteName}
          view="faq"
          logoSrc={siteConfig.logoSrc}
          discordInviteUrl={siteConfig.discordInviteUrl}
        />

        <main className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Help</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Frequently asked questions</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-700 dark:text-gray-200">
              Quick answers to common questions about how the Storage Catalog works and how to get help.
            </p>
          </section>

          <section className="space-y-4">
            {faqItems.map((item) => (
              <article
                key={item.question}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <h2 className="text-lg font-semibold sm:text-xl">{item.question}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{item.answer}</p>
                {item.links?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.links.map((link) => (
                      <a
                        key={`${item.question}-${link.href}-${link.label}`}
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noreferrer" : undefined}
                        className="inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-gray-700 dark:text-sky-300 dark:hover:border-sky-500/60 dark:hover:bg-sky-900/30"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
