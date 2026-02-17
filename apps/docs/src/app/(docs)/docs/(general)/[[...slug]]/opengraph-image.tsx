import { ImageResponse } from "next/og";
import { DocsLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";
import { getPage } from "@/src/lib/source";

export const runtime = "edge";
export const alt = "Lightfast Documentation";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = slug ? getPage(slug) : null;
  const fonts = await loadFonts();

  const title = page?.data.title ?? "Documentation";

  // Derive breadcrumb from slug segments (e.g. ["get-started", "overview"] → ["Get Started", "Overview"])
  const breadcrumb = slug?.map((segment) =>
    segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  );

  return new ImageResponse(
    <DocsLayout title={title} breadcrumb={breadcrumb} />,
    { ...size, fonts },
  );
}
