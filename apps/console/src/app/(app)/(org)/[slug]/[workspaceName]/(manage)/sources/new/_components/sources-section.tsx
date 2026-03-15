"use client";

import { PROVIDER_SLUGS } from "@repo/console-providers";
import { Accordion } from "@repo/ui/components/ui/accordion";
import { ProviderSourceItem } from "./provider-source-item";

export function SourcesSection() {
  return (
    <Accordion className="w-full rounded-lg border" type="multiple">
      {PROVIDER_SLUGS.map((slug) => (
        <ProviderSourceItem key={slug} provider={slug} />
      ))}
    </Accordion>
  );
}
