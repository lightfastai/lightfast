import { collectAllPages } from "./collect";
import { toLlmsTxt } from "./format";
import type {
  DiscoveryOptions,
  HandlerOptions,
  LlmsTxtOptions,
  PageProvider,
} from "./types";

/**
 * Next.js App Router handler factory for /llms.txt.
 * Usage: export const { GET } = createLlmsTxtHandler(providers, opts, handlerOpts)
 */
export function createLlmsTxtHandler(
  providers: PageProvider[],
  opts: LlmsTxtOptions,
  handlerOpts: HandlerOptions,
  discoveryOpts?: DiscoveryOptions
): { GET: () => Promise<Response> } {
  return {
    async GET() {
      const pages = await collectAllPages(providers, discoveryOpts);
      const body = toLlmsTxt(pages, opts);
      return new Response(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": handlerOpts.cacheControl,
        },
      });
    },
  };
}
