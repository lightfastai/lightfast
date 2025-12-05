import { generateBlogFeed } from "~/lib/feeds/generate-feed";

// Using Node.js runtime for feed generation (feed package requires it)
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const feed = await generateBlogFeed();
  const atom = feed.atom1();

  return new Response(atom, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}