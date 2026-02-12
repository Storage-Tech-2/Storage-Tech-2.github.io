import Image from "next/image";
import Link from "next/link";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { LegacyRedirect } from "@/components/home/LegacyRedirect";
import { siteConfig } from "@/lib/siteConfig";
import { PillarCard } from "@/components/home/PillarCard";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { createCollectionPageJsonLd } from "@/lib/jsonLd";

const homeTitle = siteConfig.siteName;
const homeDescription = siteConfig.siteDescription;

export default function Home() {
  const pillars = [
    {
      title: "A curated archive",
      body: "The latest designs annotated with documentation so you can find inspiration fast.",
      href: "/archives",
      cta: "Browse the archive",
    },
    {
      title: "Living dictionary",
      body: "Short, precise definitions for the jargon and mechanics behind every contraption in the community.",
      href: "/dictionary",
      cta: "Open the dictionary",
    },
    {
      title: "Mods and tools",
      body: "Discover the essential mods and tools that make building, testing, and managing storage tech easier.",
      href: "/mods-and-tools",
      cta: "See the recommendations",
    },
    {
      title: "Frequently asked questions",
      body: "Get quick answers about the archive, dictionary, and where to find help in the community.",
      href: "/faq",
      cta: "Read the FAQ",
    },
    {
      title: "Community-first",
      body: "Learn with peers, ask questions, and share new breakthroughs in our Discord, or play together on our public server.",
      href: siteConfig.discordInviteUrl ?? "#",
      cta: "Join the Discord",
    },
  ];
  const homeJsonLd = createCollectionPageJsonLd({
    path: "/",
    title: homeTitle,
    description: homeDescription,
    type: "WebPage",
    imagePath: "/social.png",
    numberOfItems: pillars.length,
    items: pillars.map((pillar) => ({
      name: pillar.title,
      description: pillar.body,
      url: pillar.href,
      type: "WebPage",
    })),
  });

  return (
    <>
      <PageJsonLd data={homeJsonLd} />
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
        <LegacyRedirect />
        <HeaderBar
          siteName={siteConfig.siteName}
          view="home"
          logoSrc={siteConfig.logoSrc}
          discordInviteUrl={siteConfig.discordInviteUrl}
        />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <section className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-hidden rounded-t-xl border-b border-gray-200 dark:border-gray-800">
            <Image
              src="/banner.webp"
              alt="Storage Catalog banner"
              width={1600}
              height={480}
              className="h-auto w-full object-cover"
              preload={true}
              fetchPriority="high"
            />
          </div>
          <div className="px-6 py-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Welcome to the Storage Catalog
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">The community for storage innovators</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-900 dark:text-gray-200">
              Want to design an awesome automated storage system for your base in Minecraft? Come on over! We love Minecraft redstone, logistics, and engineering. Our community of enthusiasts will help you to learn more about Minecraft storage technologies, everything from basic filters to the most advanced variable sorting systems. All of any skill level/experience are welcome!
            </p>
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Find exactly what you need</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {pillars.map((pillar) => (
              <PillarCard key={pillar.title} pillar={pillar} />
            ))}
          </div>
        </section>

        <section className="mt-12 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <a href="https://storagecatalog.org/item-layout-tool/" target="_blank" rel="noreferrer" className="block">
            <Image
              src="/layout_tool.webp"
              alt="Item Layout Tool interface preview"
              width={1600}
              height={900}
              className="h-auto w-full object-cover"
            />
          </a>
          <div className="space-y-3 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Featured tool
            </p>
            <h2 className="text-2xl font-semibold sm:text-3xl">Design your own storage layout</h2>
            <p className="text-base leading-relaxed text-gray-900 dark:text-gray-200">
              Use the Item Layout Tool to plan and arrange your own storage system before you build it in-game.
              Experiment with different layouts to prototype faster, then export your design to a schematic with a single click when you&apos;re ready to build.
            </p>
            <a
              href="/item-layout-tool"
              className="inline-flex items-center text-sm font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
            >
              Open the Item Layout Tool
            </a>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">ChatGPT but for Storage Tech</h2>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">

            <p className="text-base leading-relaxed text-gray-900 dark:text-gray-200">
              Chat with our AI assistant to get quick answers to your storage tech questions, or to get help brainstorming solutions for your next big storage project. It can explain how different mechanics work, give you ideas for how to approach a design problem, and more. All without judging you for asking a question that might seem basic or obvious. <a href={siteConfig.discordInviteUrl} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">Join our Discord</a> to chat with the assistant.
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Built by the community, for the community</h2>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">

            <p className="text-base leading-relaxed text-gray-900 dark:text-gray-200">
              We organize the Storage Catalog to be a community-first platform where we care about your learning and growth.

              We were founded after seeing how confusing and fragmented storage tech information could be, and what a difference a clear, well-organized resource could make for builders of all skill levels.

              You can read our founding principles and governance model on our <Link href="/about" className="font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">About page</Link>.
            </p>
          </div>
        </section>
      </main>

        <Footer />
      </div>
    </>
  );
}
