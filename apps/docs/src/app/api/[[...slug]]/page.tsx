import { getApiPage, getApiPages } from "@/src/lib/source";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SharedPage } from "@/src/components/shared-page";
import { generatePageMetadata } from "@/src/lib/metadata-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;

  // Redirect /api to /api/overview
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/api/overview");
  }

  const page = getApiPage(resolvedParams.slug);

  if (!page) {
    return notFound();
  }

  const MDX = page.data.body;
  const toc = page.data.toc;

  return <SharedPage MDX={MDX} toc={toc} />;
}

export function generateStaticParams() {
  return getApiPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const page = getApiPage(resolvedParams.slug);
  return generatePageMetadata(page?.data ?? null);
}