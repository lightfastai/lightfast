import { generateBlogFeed } from "~/lib/feeds/generate-feed";

// Alias for rss.xml - many feed readers expect /feed.xml
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const feed = await generateBlogFeed();
  const rss = feed.rss2();

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
