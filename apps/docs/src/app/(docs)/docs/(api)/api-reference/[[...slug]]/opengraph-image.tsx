import { ImageResponse } from "next/og";
import { DocsLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";
import { getApiPage } from "@/src/lib/source";

export const runtime = "edge";
export const alt = "Lightfast API Reference";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = slug ? getApiPage(slug) : null;
  const fonts = await loadFonts();

  const title = page?.data.title ?? "API Reference";

  return new ImageResponse(
    <DocsLayout title={title} section="API Reference" />,
    { ...size, fonts },
  );
}
