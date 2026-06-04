import { createFileRoute } from "@tanstack/react-router";
import { generateChangelogFeed } from "~/lib/content-feeds";

const feedHeaders = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

export const Route = createFileRoute("/changelog/feed.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(generateChangelogFeed().rss2(), { headers: feedHeaders }),
    },
  },
});
