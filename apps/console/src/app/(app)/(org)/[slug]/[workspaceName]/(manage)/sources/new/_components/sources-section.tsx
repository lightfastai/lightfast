"use client";

import { PROVIDER_DISPLAY, PROVIDER_SLUGS } from "@repo/console-providers";
import { Accordion, AccordionItem } from "@repo/ui/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { ProviderSourceItem } from "./provider-source-item";

export function SourcesSection() {
  return (
    <Accordion className="w-full rounded-lg border" type="multiple">
      {PROVIDER_SLUGS.map((slug) => {
        const display = PROVIDER_DISPLAY[slug];
        if ((display as { comingSoon?: true }).comingSoon) {
          const Icon = IntegrationLogoIcons[slug];
          return (
            <AccordionItem key={slug} value={slug}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex cursor-not-allowed items-center gap-3 px-4 py-4 opacity-50">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium text-sm">
                      {display.displayName}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
            </AccordionItem>
          );
        }
        return <ProviderSourceItem key={slug} provider={slug} />;
      })}
    </Accordion>
  );
}
