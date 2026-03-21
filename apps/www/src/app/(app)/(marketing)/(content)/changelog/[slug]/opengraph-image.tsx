import { ContentLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { changelog } from "@vendor/cms";
import { ImageResponse } from "next/og";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Lightfast Changelog Entry";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fonts = await loadOGFonts();

  let title = "Changelog";
  let description: string | undefined;
  let date: string | undefined;

  try {
    const entry = await changelog.getEntryBySlug(slug);
    if (entry) {
      title = entry._title;
      description = entry.excerpt ?? undefined;
      const publishedAt = entry.publishedAt;
      date = publishedAt
        ? new Date(publishedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : undefined;
    }
  } catch {
    // Fall back to defaults
  }

  return new ImageResponse(
    <ContentLayout
      category="Changelog"
      date={date}
      description={description}
      title={title}
    />,
    { ...size, fonts }
  );
}
