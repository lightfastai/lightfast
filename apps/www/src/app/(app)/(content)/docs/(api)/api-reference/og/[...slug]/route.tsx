import { DocsLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { getApiPage, getApiPages } from "~/app/(app)/(content)/_lib/source";
import { loadOGFonts } from "~/lib/og-fonts";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getApiPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const fonts = await loadOGFonts();

  const page = getApiPage(slug);

  if (!page) {
    return new ImageResponse(<div>Not Found</div>, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
    });
  }

  return new ImageResponse(
    <DocsLayout
      section="API Reference"
      title={page.data.title ?? "API Reference"}
    />,
    { width: OG_WIDTH, height: OG_HEIGHT, fonts }
  );
}
