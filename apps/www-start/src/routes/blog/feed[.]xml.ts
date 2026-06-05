import { createFileRoute } from "@tanstack/react-router";
import { generateBlogFeed } from "~/lib/content-feeds";

const feedHeaders = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

export const Route = createFileRoute("/blog/feed.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(generateBlogFeed().rss2(), { headers: feedHeaders }),
    },
  },
});
