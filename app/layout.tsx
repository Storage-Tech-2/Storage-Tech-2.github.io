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
  description: "Static-exported archive for Storage Tech 2 with live GitHub-powered data.",
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: `${siteConfig.siteName} Archive`,
    description: "Static-exported archive for Storage Tech 2 with live GitHub-powered data.",
    url: "/",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: `${siteConfig.siteName} logo`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.siteName} Archive`,
    description: "Static-exported archive for Storage Tech 2 with live GitHub-powered data.",
    images: ["/logo.png"],
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
