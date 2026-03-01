"use client";

import { Accordion } from "@repo/ui/components/ui/accordion";
import { GitHubSourceItem } from "./github-source-item";
import { VercelSourceItem } from "./vercel-source-item";
import { LinearSourceItem } from "./linear-source-item";
import { SentrySourceItem } from "./sentry-source-item";

/**
 * Sources section accordion.
 * Renders GitHub, Vercel, Linear, and Sentry accordion items.
 * Each item fetches its own connection status (prefetched by parent page RSC).
 * Wrapped in Suspense by the parent page.
 */
export function SourcesSection() {
  return (
    <Accordion type="multiple" className="w-full rounded-lg border">
      <GitHubSourceItem />
      <VercelSourceItem />
      <LinearSourceItem />
      <SentrySourceItem />
    </Accordion>
  );
}
