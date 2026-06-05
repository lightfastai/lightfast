import { createFileRoute } from "@tanstack/react-router";
import { generateChangelogFeed } from "~/lib/content-feeds";

const feedHeaders = {
  "Content-Type": "application/atom+xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

export const Route = createFileRoute("/changelog/atom.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(generateChangelogFeed().atom1(), { headers: feedHeaders }),
    },
  },
});
