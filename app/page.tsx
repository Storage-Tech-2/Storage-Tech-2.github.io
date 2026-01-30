import Image from "next/image";
import Link from "next/link";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { LegacyRedirect } from "@/components/home/LegacyRedirect";
import { siteConfig } from "@/lib/siteConfig";
import { PillarCard } from "@/components/home/PillarCard";

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
      title: "Community-first",
      body: "Learn with peers, ask questions, and share new breakthroughs in our Discord, or play together on our public server.",
      href: siteConfig.discordInviteUrl ?? "#",
      cta: "Join the Discord",
    },
  ];

  return (
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
              alt="Storage Tech 2 banner"
              width={1600}
              height={480}
              className="h-auto w-full object-cover"
              preload={true}
              fetchPriority="high"
            />
          </div>
          <div className="px-6 py-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Welcome to Storage Tech 2
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">The community for storage innovators</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-900 dark:text-gray-200">
              Storage tech is our passion, and it can be yours too! Whether you&apos;re just starting out or a seasoned designer, we&apos;re here to help you learn more about the latest storage technologies!
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

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Built by the community, for the community</h2>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">

            <p className="text-base leading-relaxed text-gray-900 dark:text-gray-200">
              We organize Storage Tech 2 to be a community-first platform where we care about your learning and growth.

              We were founded after seeing how confusing and fragmented storage tech information could be, and what a difference a clear, well-organized resource could make for builders of all skill levels.

              You can read our founding principles and governance model on our <Link href="/about" className="font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">About page</Link>.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
