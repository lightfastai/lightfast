import { generateChangelogFeed } from "~/lib/feeds/generate-changelog-feed";

// Alias for rss.xml - some feed readers expect /feed.xml
export const revalidate = 3600;

export async function GET() {
  const feed = await generateChangelogFeed();
  const rss = feed.rss2();

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
