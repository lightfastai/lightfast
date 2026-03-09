"use client";

import type { SourceType } from "@repo/console-providers";
import {
  PROVIDER_DISPLAY,
  PROVIDER_SLUGS,
} from "@repo/console-providers/display";
import { useTRPC } from "@repo/console-trpc/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Circle,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { useState } from "react";
import { ConfigTemplateDialog } from "~/components/config-template-dialog";
import { ProviderIcon } from "~/lib/provider-icon";
import { getResourceLabel } from "~/lib/resource-label";
import type { Source } from "~/types";
import { SourceSettingsForm } from "./source-settings-form";

interface InstalledSourcesProps {
  clerkOrgSlug: string;
  initialSearch?: string;
  initialStatus?: "all" | "active" | "inactive";
  workspaceName: string;
}

export function InstalledSources({
  clerkOrgSlug,
  workspaceName,
  initialSearch = "",
  initialStatus = "all",
}: InstalledSourcesProps) {
  const trpc = useTRPC();

  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(initialSearch),
      status: parseAsStringEnum<"all" | "active" | "inactive">([
        "all",
        "active",
        "inactive",
      ]).withDefault(initialStatus),
    },
    {
      history: "push",
      shallow: true,
    }
  );

  const { data: sourcesData } = useSuspenseQuery({
    ...trpc.workspace.sources.list.queryOptions({
      clerkOrgSlug,
      workspaceName,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const integrations = sourcesData.list;

  // Filter integrations
  const searchLower = filters.search.toLowerCase();
  const filteredIntegrations = integrations.filter((integration) => {
    const { metadata } = integration;
    const providerLabel = PROVIDER_DISPLAY[metadata.sourceType].displayName;
    const resourceLabel = getResourceLabel(metadata);
    const searchTarget = `${providerLabel}/${resourceLabel}`.toLowerCase();

    const matchesSearch = !searchLower || searchTarget.includes(searchLower);
    const matchesStatus =
      filters.status === "all" || filters.status === "active";

    return matchesSearch && matchesStatus;
  });

  // Group by provider — sourceType is always a known SourceType, no "unknown" handling needed
  const grouped = new Map<SourceType, Source[]>();
  for (const integration of filteredIntegrations) {
    const type = integration.metadata.sourceType;
    const list = grouped.get(type) ?? [];
    list.push(integration);
    grouped.set(type, list);
  }

  const sortedGroups = PROVIDER_SLUGS.filter((p) => grouped.has(p)).map(
    (p) => ({ provider: p, resources: grouped.get(p) ?? [] })
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search integrations..."
            value={filters.search}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-[150px] justify-between" variant="outline">
              <span className="text-left">
                {filters.status === "all" && "All Integrations"}
                {filters.status === "active" && "Active Only"}
                {filters.status === "inactive" && "Inactive Only"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilters({ status: "all" })}>
              All Integrations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilters({ status: "active" })}>
              Active Only
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFilters({ status: "inactive" })}
            >
              Inactive Only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Provider-grouped list */}
      {sortedGroups.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {filters.search
              ? `No integrations found matching "${filters.search}"`
              : "No integrations installed yet"}
          </p>
          {!filters.search && (
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href={`/${clerkOrgSlug}/${workspaceName}/sources/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Add Source
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <Accordion className="w-full rounded-lg border" type="multiple">
          {sortedGroups.map(({ provider, resources }) => {
            const display = PROVIDER_DISPLAY[provider];

            return (
              <AccordionItem key={provider} value={provider}>
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex flex-1 items-center gap-3">
                    <ProviderIcon
                      className="h-5 w-5 shrink-0"
                      icon={display.icon}
                    />
                    <span className="font-medium">{display.displayName}</span>
                    <Badge className="text-xs" variant="secondary">
                      {resources.length} connected
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <div className="divide-y border-t">
                    {resources.map((resource) => (
                      <ResourceRow integration={resource} key={resource.id} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

function ResourceRow({ integration }: { integration: Source }) {
  const [isOpen, setIsOpen] = useState(false);
  const { metadata } = integration;

  const isAwaitingConfig =
    metadata.sourceType === "github" &&
    metadata.status?.configStatus === "awaiting_config";
  const subscribedEvents = metadata.sync.events ?? [];
  const eventLabel =
    subscribedEvents.length === 0
      ? "All events"
      : `${subscribedEvents.length} events`;
  const resourceName = getResourceLabel(metadata);

  return (
    <Collapsible onOpenChange={setIsOpen} open={isOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
          type="button"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Circle
              className={cn(
                "h-2 w-2 shrink-0 fill-current",
                isAwaitingConfig ? "text-amber-500" : "text-green-500"
              )}
            />
            <span className="truncate font-medium text-sm">{resourceName}</span>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-3">
            {integration.documentCount > 0 && (
              <span className="text-muted-foreground text-xs">
                {integration.documentCount.toLocaleString()} docs
              </span>
            )}
            <span className="text-muted-foreground text-xs">{eventLabel}</span>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {isAwaitingConfig && (
          <div className="mx-4 mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div className="flex-1 text-xs">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Configuration Required
                </p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                  Add a{" "}
                  <ConfigTemplateDialog>
                    <button
                      className="font-mono underline hover:no-underline"
                      type="button"
                    >
                      lightfast.yml
                    </button>
                  </ConfigTemplateDialog>{" "}
                  file to start indexing.
                </p>
              </div>
            </div>
          </div>
        )}
        <SourceSettingsForm
          backfillConfig={integration.backfillConfig ?? null}
          currentEvents={subscribedEvents}
          installationId={integration.installationId}
          integrationId={integration.id}
          provider={metadata.sourceType}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
