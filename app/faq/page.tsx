import type { Metadata } from "next";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { createFaqPageJsonLd } from "@/lib/jsonLd";
import { siteConfig } from "@/lib/siteConfig";

const faqTitle = `FAQ · ${siteConfig.siteName}`;
const faqDescription = "Answers to common questions about Minecraft storage tech, how the Storage Catalog works, and where to find help in the community.";

const faqItems = [
  {
    question: "What is the Storage Catalog?",
    answer:
      "Storage Catalog is a community-maintained hub for Minecraft storage tech. It includes a searchable archive of builds, documentation, and a dictionary of technical terms.",
  },
  {
    question: "What is the difference between the Archive and the Dictionary?",
    answer:
      "The Archive lists concrete builds and design entries. The Dictionary explains terminology and mechanics used across those entries.",
  },
  {
    question: "How do I find a specific design quickly?",
    answer:
      "Use Archive search with terms, tags, authors, or entry codes. You can also sort and filter results to narrow to a specific category or component.",
  },
  {
    question: "Where can I ask for help with a build?",
    answer:
      "Join the Storage Tech Discord for design help, troubleshooting, and feedback from community members and staff.",
  },
  {
    question: "How often is the archive updated?",
    answer:
      "The archive is updated whenever new entries are curated and published. Existing entries can also be updated with fixes, revisions, and improved documentation.",
  },
  {
    question: "Can beginners use this site?",
    answer:
      "Yes. The site is designed for all skill levels, with beginner-friendly explanations in the dictionary and progressively advanced archive entries.",
  },
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
              </article>
            ))}
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
