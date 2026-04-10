import { FeatureLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { getLegalPage } from "~/app/(app)/(content)/_lib/source";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Lightfast Legal";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getLegalPage([slug]);
  const fonts = await loadOGFonts();

  if (!page) {
    return new ImageResponse(<div>Not Found</div>, { ...size });
  }

  const { title, description } = page.data;

  return new ImageResponse(
    <FeatureLayout description={description} title={title} />,
    { ...size, fonts }
  );
}
