"use client";

import { Accordion } from "@repo/ui/components/ui/accordion";
import { ORDERED_ADAPTERS } from "./adapters";
import { ProviderSourceItem } from "./provider-source-item";

export function SourcesSection() {
  return (
    <Accordion className="w-full rounded-lg border" type="multiple">
      {ORDERED_ADAPTERS.map((adapter) => (
        <ProviderSourceItem adapter={adapter} key={adapter.provider} />
      ))}
    </Accordion>
  );
}
