import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${siteConfig.siteName} Archive`,
  description: "",
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: `${siteConfig.siteName} Archive`,
    description: siteConfig.siteDescription,
    url: "/",
    images: [
      {
        url: "/social.png",
        alt: `${siteConfig.siteName} Archive`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.siteName} Archive`,
    description: siteConfig.siteDescription,
    images: ["/social.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900 dark:bg-black dark:text-white`}>
        {children}
      </body>
    </html>
  );
}
