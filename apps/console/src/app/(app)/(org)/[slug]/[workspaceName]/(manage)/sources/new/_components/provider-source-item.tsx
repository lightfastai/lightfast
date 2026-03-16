"use client";

import type { NormalizedResource } from "@repo/console-providers";
import { PROVIDER_DISPLAY, type ProviderSlug } from "@repo/console-providers";
import { useTRPC } from "@repo/console-trpc/react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { useQueries, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import { useSourceSelection } from "./source-selection-provider";

interface Props {
  provider: ProviderSlug;
}

export function ProviderSourceItem({ provider }: Props) {
  const display = PROVIDER_DISPLAY[provider];
  const Icon = IntegrationLogoIcons[provider];
  const trpc = useTRPC();
  const {
    getState,
    setInstallations,
    setSelectedInstallation,
    toggleResource,
    setSelectedResources,
  } = useSourceSelection();
  const state = getState(provider);

  const [searchQuery, setSearchQuery] = useState("");
  const [showPicker, setShowPicker] = useState(true);
  const preferNewestRef = useRef(false);
  const installationIdsBeforeRef = useRef<Set<string>>(new Set());

  // ── OAuth ────────────────────────────────────────────────────────────────
  const listInstallationsOpts =
    trpc.connections.generic.listInstallations.queryOptions({ provider });
  const {
    handleConnect: connectOAuth,
    isConnecting,
    openCustomUrl,
  } = useOAuthPopup({
    provider,
    queryKeysToInvalidate: [
      listInstallationsOpts.queryKey,
      ["connections", "generic", "listResources"],
    ],
    onSuccess: () => {
      preferNewestRef.current = true;
    },
  });

  const handleConnect = () => {
    installationIdsBeforeRef.current = new Set(
      state.installations.map((i) => i.id)
    );
    void connectOAuth();
  };

  const customConnectUrl =
    provider === "github"
      ? (data: { url: string; state: string }) =>
          `https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target?state=${data.state}`
      : undefined;

  const handleAdjustPermissions =
    customConnectUrl && openCustomUrl
      ? () => {
          installationIdsBeforeRef.current = new Set(
            state.installations.map((i) => i.id)
          );
          void openCustomUrl(customConnectUrl);
        }
      : null;

  // ── Connection query ─────────────────────────────────────────────────────
  const { data: connectionData } = useSuspenseQuery({
    ...trpc.connections.generic.listInstallations.queryOptions({ provider }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { installationMode, resourceLabel, installations } = connectionData;
  const hasConnection = installations.length > 0;

  // ── Sync installations to context ────────────────────────────────────────
  const prevInstallationIdsRef = useRef("");
  useEffect(() => {
    const newIds = installations.map((i) => i.id).join(",");
    if (prevInstallationIdsRef.current !== newIds) {
      setInstallations(provider, installations);
      prevInstallationIdsRef.current = newIds;
    }
  }, [installations, provider, setInstallations]);

  // ── Auto-select installation ─────────────────────────────────────────────
  useEffect(() => {
    if (installations.length === 0) {
      if (state.selectedInstallation) {
        setSelectedInstallation(provider, null);
      }
      return;
    }
    if (preferNewestRef.current) {
      preferNewestRef.current = false;
      const beforeIds = installationIdsBeforeRef.current;
      const newInst = installations.find((inst) => !beforeIds.has(inst.id));
      if (newInst) {
        setSelectedInstallation(provider, newInst);
        return;
      }
    }
    const stillExists = state.selectedInstallation
      ? installations.some((inst) => inst.id === state.selectedInstallation!.id)
      : false;
    if (!stillExists) {
      const first = installations[0];
      if (first && state.selectedInstallation?.id !== first.id) {
        setSelectedInstallation(provider, first);
      }
    }
  }, [
    installations,
    state.selectedInstallation,
    provider,
    setSelectedInstallation,
  ]);

  // ── Resource queries ─────────────────────────────────────────────────────
  const selectedInstallation = state.selectedInstallation;

  const singleResourceQuery = useQuery({
    ...trpc.connections.generic.listResources.queryOptions({
      provider,
      installationId: selectedInstallation?.id ?? "",
    }),
    enabled: installationMode !== "merged" && Boolean(selectedInstallation),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const mergedResourceQueries = useQueries({
    queries:
      installationMode === "merged"
        ? installations.map((inst) => ({
            ...trpc.connections.generic.listResources.queryOptions({
              provider,
              installationId: inst.id,
            }),
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            retry: false,
          }))
        : [],
  });

  // ── Normalize resources ──────────────────────────────────────────────────
  let allResources: NormalizedResource[] = [];
  let isLoadingResources = false;
  let resourcesError: Error | null = null;

  if (installationMode === "merged") {
    isLoadingResources = mergedResourceQueries.some((q) => q.isLoading);
    resourcesError =
      mergedResourceQueries.every((q) => q.error) &&
      mergedResourceQueries.length > 0
        ? ((mergedResourceQueries[0]?.error as unknown as Error) ?? null)
        : null;
    for (const query of mergedResourceQueries) {
      if (query?.data) {
        allResources = allResources.concat(query.data.resources);
      }
    }
  } else {
    isLoadingResources = singleResourceQuery.isLoading;
    resourcesError = singleResourceQuery.error as unknown as Error | null;
    if (singleResourceQuery.data) {
      allResources = singleResourceQuery.data.resources;
    }
  }

  const filteredResources = allResources.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false) ||
      (r.badge?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const selectedResource = state.selectedResources[0] ?? null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const renderIcon = (resource: NormalizedResource) => {
    if (resource.iconColor && resource.iconLabel) {
      return (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: resource.iconColor }}
        >
          <span className="font-bold text-white text-xs">
            {resource.iconLabel}
          </span>
        </div>
      );
    }
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-3 w-3" />
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AccordionItem value={provider}>
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="font-medium">{display.displayName}</span>
          {hasConnection ? (
            <Badge className="text-xs" variant="secondary">
              Connected
            </Badge>
          ) : (
            <Badge className="text-muted-foreground text-xs" variant="outline">
              Not connected
            </Badge>
          )}
          {selectedResource && (
            <Badge className="mr-2 ml-auto text-xs" variant="default">
              1 selected
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        {hasConnection ? (
          <div className="space-y-4 pt-2">
            {selectedResource && !showPicker ? (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  {renderIcon(selectedResource)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {selectedResource.name}
                      </span>
                      {selectedResource.badge && (
                        <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                          {selectedResource.badge}
                        </span>
                      )}
                    </div>
                    {selectedResource.subtitle && (
                      <p className="line-clamp-1 text-muted-foreground text-sm">
                        {selectedResource.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      onClick={() => setShowPicker(true)}
                      size="sm"
                      variant="outline"
                    >
                      Change
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedResources(provider, []);
                        setShowPicker(true);
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-4">
                  {installationMode === "multi" && (
                    <Select
                      onValueChange={(id) => {
                        const inst = installations.find((i) => i.id === id);
                        if (inst) {
                          setSelectedInstallation(provider, inst);
                        }
                      }}
                      value={selectedInstallation?.id}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {installations.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            <div className="flex items-center gap-2">
                              {inst.avatarUrl ? (
                                <Image
                                  alt=""
                                  className="rounded-full"
                                  height={16}
                                  src={inst.avatarUrl}
                                  width={16}
                                />
                              ) : (
                                <Icon className="h-4 w-4" />
                              )}
                              {inst.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {installationMode === "single" && (
                    <div className="flex shrink-0 items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                      <Icon className="h-3 w-3" />
                      <span className="font-medium text-sm">
                        {display.displayName}
                      </span>
                    </div>
                  )}
                  <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${resourceLabel}...`}
                      value={searchQuery}
                    />
                  </div>
                </div>

                <div className="max-h-[260px] overflow-y-auto rounded-lg border bg-card">
                  {resourcesError ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <p className="text-destructive text-sm">
                        Failed to load {resourceLabel}. The connection may need
                        to be refreshed.
                      </p>
                      <Button
                        onClick={handleConnect}
                        size="sm"
                        variant="outline"
                      >
                        Reconnect {display.displayName}
                      </Button>
                    </div>
                  ) : isLoadingResources ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading {resourceLabel}...
                    </div>
                  ) : filteredResources.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {searchQuery
                        ? `No ${resourceLabel} match your search`
                        : `No ${resourceLabel} found`}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredResources.map((resource) => (
                        <button
                          className={`flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent ${
                            selectedResource?.id === resource.id
                              ? "bg-accent/50"
                              : ""
                          }`}
                          key={resource.id}
                          onClick={() => {
                            toggleResource(provider, resource);
                            if (selectedResource?.id !== resource.id) {
                              setShowPicker(false);
                            }
                          }}
                          type="button"
                        >
                          {renderIcon(resource)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">
                                {resource.name}
                              </span>
                              {resource.badge && (
                                <span className="shrink-0 rounded border px-2 py-0.5 text-muted-foreground text-xs">
                                  {resource.badge}
                                </span>
                              )}
                            </div>
                            {resource.subtitle && (
                              <p className="mt-0.5 truncate text-muted-foreground text-xs">
                                {resource.subtitle}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center text-muted-foreground text-sm">
                  Missing a {resourceLabel.replace(/s$/, "")}?{" "}
                  <button
                    className="text-blue-500 underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                    onClick={handleAdjustPermissions ?? handleConnect}
                  >
                    {handleAdjustPermissions
                      ? `Adjust ${display.displayName} permissions \u2192`
                      : `Reconnect ${display.displayName} \u2192`}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              {display.description}
            </p>
            <Button
              disabled={isConnecting}
              onClick={handleConnect}
              variant="outline"
            >
              <Icon className="mr-2 h-4 w-4" />
              Connect {display.displayName}
              {isConnecting && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
