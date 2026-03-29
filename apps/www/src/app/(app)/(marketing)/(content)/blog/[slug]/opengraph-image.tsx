import { ContentLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { getBlogPage } from "~/app/(app)/(content)/_lib/source";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Lightfast Blog Post";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  const fonts = await loadOGFonts();

  if (!page) {
    return new ImageResponse(<div>Not Found</div>, { ...size });
  }

  const { title, description, category, publishedAt, authors } = page.data;

  return new ImageResponse(
    <ContentLayout
      author={authors[0]?.name ?? "Lightfast"}
      category={category.charAt(0).toUpperCase() + category.slice(1)}
      date={new Date(publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
      description={description}
      title={title}
    />,
    { ...size, fonts }
  );
}
