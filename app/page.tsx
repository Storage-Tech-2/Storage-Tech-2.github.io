import Link from "next/link";
import { HeaderBar } from "@/components/archive/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { LegacyRedirect } from "@/components/home/LegacyRedirect";
import { siteConfig } from "@/lib/siteConfig";

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
        <section className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Welcome to Storage Tech 2
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">The community for storage innovators</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-700 dark:text-gray-200">
            Storage tech is our passion, and it can be yours too! Whether you're just starting out or a seasoned designer, we're here to help you learn more about the latest storage technologies!
          </p>

        </section>

        <section className="mt-12 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Find exactly what you need</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {pillars.map((pillar) => {
              const isExternal = pillar.href.startsWith("http");
              const card = (
                <div className="flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      {pillar.title}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{pillar.body}</p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition dark:text-sky-300">
                    {pillar.cta}
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
              );

              return isExternal ? (
                <a key={pillar.title} href={pillar.href} target="_blank" rel="noreferrer" className="h-full">
                  {card}
                </a>
              ) : (
                <Link key={pillar.title} href={pillar.href} className="h-full">
                  {card}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
           <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Built by the community, for the community</h2>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
         
            <p className="text-base leading-relaxed text-gray-700 dark:text-gray-200">
              We collect reliable storage builds, the vocabulary behind them, and the context that makes them work.
              Everything is organized so you can skim, copy, and improve without digging through scattered links.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-gray-100 px-4 py-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                Quiet, readable pages with the sources and tags you need.
              </div>
              <div className="rounded-md bg-gray-100 px-4 py-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                Community-reviewed entries that stay up to date as the game evolves.
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
