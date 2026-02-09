import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/siteConfig";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AutoReloadOnChunkError } from "@/components/AutoReloadOnChunkError";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: siteConfig.siteName,
  description: siteConfig.siteDescription,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: siteConfig.siteName,
    description: siteConfig.siteDescription,
    url: "/",
    images: [
      {
        url: "/social.png",
        alt: siteConfig.siteName,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteConfig.siteName,
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
      <head>
        <link
          rel="icon"
          href="/icon?<generated>"
          type="image/<generated>"
          sizes="<generated>"
        />
        <GoogleAnalytics gaId="G-W8ZF7F6FXL" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900 dark:bg-black dark:text-white`}>
        <AutoReloadOnChunkError />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
