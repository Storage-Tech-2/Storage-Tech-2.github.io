import Image from "next/image";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { Footer } from "@/components/layout/Footer";
import { siteConfig } from "@/lib/siteConfig";
import type { Metadata } from "next";
import { PageJsonLd } from "@/components/seo/PageJsonLd";
import { createAboutPageJsonLd } from "@/lib/jsonLd";

type Person = {
  name: string;
  role: string;
  iconSrc: string;
  iconAlt?: string;
  note?: string;
};

const aboutTitle = `About · ${siteConfig.siteName}`;
const aboutDescription = "Meet the Storage Catalog team, previous leaders, and read the community constitution.";

export const metadata: Metadata = {
  title: aboutTitle,
  description: aboutDescription,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: aboutTitle,
    description: aboutDescription,
    url: `/about`,
    images: [
      {
        url: `/banner.webp`
      },
    ]
  },
  twitter: {
    card: "summary",
    title: aboutTitle,
    description: aboutDescription,
    images: ["/banner.webp"]
  },
};

const ceo: Person = {
  name: "TisUnfortunate",
  role: "2026 Chief Executive Officer",
  iconSrc: "/staff/TisUnfortunate.png",
  iconAlt: "TisUnfortunate profile picture",
};

const board: Person[] = [
  {
    name: "51Mayday",
    role: "Board",
    iconSrc: "/staff/51Mayday.png",
    iconAlt: "51Mayday profile picture",
  },
  {
    name: "Jaexyn",
    role: "Board",
    iconSrc: "/staff/Jaexyn.png",
    iconAlt: "Jaexyn profile picture",
  },
  {
    name: "ValBlaze",
    role: "Board",
    iconSrc: "/staff/ValBlaze.png",
    iconAlt: "ValBlaze profile picture",
  }
];

const staff: Person[] = [
  {
    name: "Rechenmaschine",
    role: "Moderator",
    iconSrc: "/staff/Rechen.png",
    iconAlt: "Rechenmaschine profile picture",
  },
  {
    name: "Pocket",
    role: "Moderator",
    iconSrc: "/staff/Pocket.png",
    iconAlt: "Pocket profile picture",
  },
  {
    name: "Kenny",
    role: "Moderator",
    iconSrc: "/staff/Kenny.png",
    iconAlt: "Kenny profile picture",
  },
  {
    name: "Giannis",
    role: "Moderator",
    iconSrc: "/staff/Giannis.png",
    iconAlt: "Giannis profile picture",
  },
  {
    name: "Terra",
    role: "Editor",
    iconSrc: "/staff/Terra.png",
    iconAlt: "Terra profile picture",
  },
  {
    name: "Ragdoll Willy",
    role: "Editor",
    iconSrc: "/staff/RagdollWilly.png",
    iconAlt: "Ragdoll Willy profile picture",
  },
  {
    name: "Hi!?",
    role: "Editor",
    iconSrc: "/staff/Hi.png",
    iconAlt: "Hi!? profile picture",
  }
];

const previousLeaders: Person[] = [
  {
    name: "Andrews54757",
    role: "Founder, 2025 Administrator",
    iconSrc: "/staff/Andrews.png",
    iconAlt: "Andrews54757 profile picture",
  },
];

const constitutionSections = [
  {
    heading: "Preamble",
    body: [
      "The Constitution of the Storage Catalog is a living document that outlines the core governance of the Storage Catalog community. This document shall be the supreme law of the community and will be the foundation upon which all other laws and policies are built.",
    ],
  },
  {
    heading: "Article I: Membership",
    body: [
      "Membership in the Storage Catalog is open to all individuals, defined as those who have joined the Storage Catalog Discord server, excluding bots and those who have been banned from the server. Members are entitled to all rights and privileges outlined in this Constitution.",
    ],
  },
  {
    heading: "Article II: Purpose",
    body: [
      "The purpose of the Storage Catalog is to provide a welcoming and inclusive community for all individuals interested in Minecraft storage technology. The Storage Catalog shall provide a platform for members to share knowledge, collaborate on projects, and engage in discussions related to Minecraft storage technology. The Storage Catalog shall also be responsible for organizing events, maintaining resources, and promoting the growth of the community.",
    ],
  },
  {
    heading: "Article III: Leadership Structure",
    body: [
      "In the interest of maintaining a fair and community-driven governance structure, the Storage Catalog shall be led using a system of managed democracy consisting of five branches: the Supreme Council, the Executive, the Board, the Moderators, and the Editorial Branch. Each branch shall have its own responsibilities and powers, as outlined in this Constitution.",
    ],
  },
  {
    heading: "Article IV: The Supreme Council",
    body: [
      "In order to ensure the security and continuing stability of the Storage Catalog, the Supreme Council shall be the highest governing body of the Storage Catalog and shall be given absolute authority over all matters. Members of the Supreme Council shall be appointed by an internal vote, based on their experience and dedication to the storage tech community. The Supreme Council shall have administrative powers over community spaces and all other branches of the Storage Catalog. The Supreme Council promises to operate in a hands-off manner and will only intervene in the event of a crisis or emergency.",
    ],
  },
  {
    heading: "Article V: The Executive Branch",
    body: [
      "The Executive Branch shall be responsible for the administrative operations of the Storage Catalog and shall be led by the Chief Executive Officer (CEO). The CEO shall be given administrative powers over community spaces. They are responsible for the overall direction and vision of the Storage Catalog. The CEO shall be appointed by general election and shall serve a term of one year.",
    ],
  },
  {
    heading: "Article VI: The Board",
    body: [
      "The Board shall be responsible for the acquisition and management of resources for the Storage Catalog. This shall include the management of funds, the acquisition of people, and the allocation of resources to various projects and initiatives. The Board shall consist of up to five members and shall embody harmony. Each member shall be appointed by the Executive Branch. Once appointed, Board members shall serve until they resign or are removed by a general referendum.",
      "Board Powers: The Board shall be responsible for the management of funds and shall have the power to allocate resources to various projects and initiatives with a majority vote. The Board shall also have the power to create and dissolve positions within the Storage Catalog with a majority vote, except for the positions outlined in this Constitution.",
    ],
  },
  {
    heading: "Article VII: The Moderators",
    body: [
      "The Moderators shall be responsible for the day-to-day operations of the Storage Catalog and shall be appointed or removed by the board. Moderators shall be responsible for moderating community spaces, organizing events, and maintaining resources.",
      "Moderator Powers: The Moderators shall embody flexibility, and be responsible for the health of discussion in community spaces. Moderators shall have the power to time out members who violate the rules and delete spam messages. The moderators shall also have the power to manage the editorial branch, including the appointment and removal of editors.",
    ],
  },
  {
    heading: "Article VIII: The Editorial Branch",
    body: [
      "The Editorial Branch is responsible for curating content for Storage Catalog archives. This shall include the tagging of posts, and reviewing and editing of posts for official publication. The Editorial Branch shall be based on a meritocratic system, with members being selected based on their contributions to the community.",
      "Editorial Powers: The Editorial Branch shall have total control over the content of the Storage Catalog archives and shall have the power to approve or reject posts for official publication at the end of the year. The Editors may also set guidelines for the submission of posts and may request revisions from authors. Editors who are inactive for more than three months shall be retired at the discretion of the moderators.",
    ],
  },
];

const aboutJsonLd = createAboutPageJsonLd({
  path: "/about",
  title: aboutTitle,
  description: aboutDescription,
  imagePath: "/banner.webp",
  members: [ceo, ...board, ...staff, ...previousLeaders].map((person) => ({
    name: person.name,
    role: person.role,
  })),
});

function PersonCard({ person, highlight }: { person: Person; highlight?: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${highlight ? "ring-1 ring-sky-300/60 dark:ring-sky-500/40" : ""
        }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40">
        <Image
          src={person.iconSrc}
          alt={person.iconAlt ?? `${person.name} icon`}
          width={44}
          height={44}
          className="rounded-full object-cover"
        />
      </div>
      <div className="space-y-1">
        <div className="text-base font-semibold">{person.name}</div>
        <div className="text-sm text-gray-600 dark:text-gray-300">{person.role}</div>
        {person.note ? <p className="text-sm text-gray-700 dark:text-gray-200">{person.note}</p> : null}
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <PageJsonLd data={aboutJsonLd} />
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
        <HeaderBar
          siteName={siteConfig.siteName}
          view="home"
          logoSrc={siteConfig.logoSrc}
          discordInviteUrl={siteConfig.discordInviteUrl}
        />

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">About</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">The people keeping the Storage Catalog thriving</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-700 dark:text-gray-200">
            Our leaders are annually elected by the community to ensure that Storage Catalog remains a welcoming space for everyone.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">CEO</h2>
          <PersonCard person={ceo} highlight />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Board of Directors</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {board.map((person) => (
              <PersonCard key={person.name} person={person} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Staff</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {staff.map((person) => (
              <PersonCard key={person.name} person={person} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Previous leaders</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {previousLeaders.map((person) => (
              <PersonCard key={person.name} person={person} />
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-2xl font-semibold">Constitution</h2>
          <div className="space-y-6">
            {constitutionSections.map((section) => (
              <article key={section.heading} className="space-y-2">
                <h3 className="text-lg font-semibold">{section.heading}</h3>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                    {paragraph}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </section>
      </main>

        <Footer />
      </div>
    </>
  );
}
