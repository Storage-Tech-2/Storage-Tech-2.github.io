import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/siteConfig";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const base = siteConfig.siteUrl.replace(/\/+$/, "");
  const body = [`User-agent: *`, `Allow: /`, `Host: ${base}`, `Sitemap: ${new URL("/sitemap.xml", base).toString()}`].join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
