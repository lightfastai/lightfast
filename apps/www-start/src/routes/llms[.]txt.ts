import { createFileRoute } from "@tanstack/react-router";
import { generateLlmsTxt } from "~/lib/seo-discovery";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(await generateLlmsTxt(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        }),
    },
  },
});
