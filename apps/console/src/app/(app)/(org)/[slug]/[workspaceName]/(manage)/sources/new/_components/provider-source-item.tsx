"use client";

import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery, useQuery, useQueries } from "@tanstack/react-query";
import Image from "next/image";
import { Search, Loader2 } from "lucide-react";
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
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { PROVIDER_DISPLAY } from "@repo/console-providers";
import { useTRPC } from "@repo/console-trpc/react";
import { useOAuthPopup } from "~/hooks/use-oauth-popup";
import type { ProviderConnectAdapter, NormalizedResource } from "./adapters";
import { useSourceSelection } from "./source-selection-provider";

interface Props {
  adapter: ProviderConnectAdapter;
}

export function ProviderSourceItem({ adapter }: Props) {
  const { provider, installationMode, resourceLabel } = adapter;
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
  const connectionQueryOpts = adapter.getConnectionQueryOptions(trpc);
  const { handleConnect: connectOAuth, openCustomUrl } = useOAuthPopup({
    provider,
    queryKeysToInvalidate: [
      connectionQueryOpts.queryKey,
      ...adapter.resourceQueryKeys,
    ],
    onSuccess: () => {
      preferNewestRef.current = true;
    },
  });

  const handleConnect = () => {
    installationIdsBeforeRef.current = new Set(state.installations.map((i) => i.id));
    void connectOAuth();
  };

  const handleAdjustPermissions =
    adapter.customConnectUrl && openCustomUrl
      ? () => {
          installationIdsBeforeRef.current = new Set(state.installations.map((i) => i.id));
          void openCustomUrl(adapter.customConnectUrl!);
        }
      : null;

  // ── Connection query ─────────────────────────────────────────────────────
  const { data: connectionData } = useSuspenseQuery({
    ...connectionQueryOpts,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const installations = adapter.extractInstallations(connectionData);
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
      if (state.selectedInstallation) setSelectedInstallation(provider, null);
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
  }, [installations, state.selectedInstallation, provider, setSelectedInstallation]);

  // ── Resource queries ─────────────────────────────────────────────────────
  const selectedInstallation = state.selectedInstallation;

  const singleResourceQuery = useQuery({
    ...adapter.getResourceQueryOptions(
      trpc,
      selectedInstallation?.id ?? "",
      selectedInstallation?.externalId ?? "",
    ),
    enabled: installationMode !== "merged" && Boolean(selectedInstallation),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const mergedResourceQueries = useQueries({
    queries:
      installationMode === "merged"
        ? installations.map((inst) => ({
            ...adapter.getResourceQueryOptions(trpc, inst.id, inst.externalId),
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            retry: false,
          }))
        : [],
  });

  // ── Normalize resources ──────────────────────────────────────────────────
  let allResources: NormalizedResource[] = [];
  let rawResources: unknown[] = [];
  let isLoadingResources = false;
  let resourcesError: Error | null = null;

  if (installationMode === "merged") {
    isLoadingResources = mergedResourceQueries.some((q) => q.isLoading);
    resourcesError =
      mergedResourceQueries.every((q) => q.error) && mergedResourceQueries.length > 0
        ? ((mergedResourceQueries[0]?.error as Error) ?? null)
        : null;
    for (let i = 0; i < installations.length; i++) {
      const query = mergedResourceQueries[i];
      if (query?.data) {
        const normalized = adapter.extractResources(query.data);
        const raw =
          (query.data as any)?.teams ?? (query.data as any)?.projects ?? [];
        for (let j = 0; j < normalized.length; j++) {
          allResources.push(normalized[j]!);
          rawResources.push({ ...(raw[j] as object), _installationId: installations[i]!.id });
        }
      }
    }
  } else {
    isLoadingResources = singleResourceQuery.isLoading;
    resourcesError = singleResourceQuery.error as Error | null;
    if (singleResourceQuery.data) {
      allResources = adapter.extractResources(singleResourceQuery.data);
      const data = singleResourceQuery.data as any;
      rawResources = Array.isArray(data)
        ? data
        : (data?.projects ?? data?.teams ?? []);
    }
  }

  const filteredResources = allResources.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (r.badge?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false),
  );

  const selectedResource = state.selectedResources[0] ?? null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const renderIcon = (resource: NormalizedResource) => {
    if (resource.iconColor && resource.iconLabel) {
      return (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
          style={{ backgroundColor: resource.iconColor }}
        >
          <span className="text-xs font-bold text-white">{resource.iconLabel}</span>
        </div>
      );
    }
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
        <Icon className="h-3 w-3" />
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AccordionItem value={provider}>
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="font-medium">{display.displayName}</span>
          {hasConnection ? (
            <Badge variant="secondary" className="text-xs">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Not connected
            </Badge>
          )}
          {selectedResource && (
            <Badge variant="default" className="text-xs ml-auto mr-2">
              1 selected
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        {!hasConnection ? (
          <div className="flex flex-col items-center py-6 text-center gap-4">
            <p className="text-sm text-muted-foreground">{display.description}</p>
            <Button onClick={handleConnect} variant="outline">
              <Icon className="h-4 w-4 mr-2" />
              Connect {display.displayName}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {selectedResource && !showPicker ? (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  {renderIcon(selectedResource)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{selectedResource.name}</span>
                      {selectedResource.badge && (
                        <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                          {selectedResource.badge}
                        </span>
                      )}
                    </div>
                    {selectedResource.subtitle && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {selectedResource.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                      Change
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedResources(provider, [], []);
                        setShowPicker(true);
                      }}
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
                      value={selectedInstallation?.id}
                      onValueChange={(id) => {
                        const inst = installations.find((i) => i.id === id);
                        if (inst) setSelectedInstallation(provider, inst);
                      }}
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
                                  src={inst.avatarUrl}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="rounded-full"
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 shrink-0">
                      <Icon className="h-3 w-3" />
                      <span className="text-sm font-medium">{display.displayName}</span>
                    </div>
                  )}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${resourceLabel}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-card max-h-[260px] overflow-y-auto">
                  {resourcesError ? (
                    <div className="flex flex-col items-center py-6 text-center gap-3">
                      <p className="text-sm text-destructive">
                        Failed to load {resourceLabel}. The connection may need to be refreshed.
                      </p>
                      <Button onClick={handleConnect} variant="outline" size="sm">
                        Reconnect {display.displayName}
                      </Button>
                    </div>
                  ) : isLoadingResources ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
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
                      {filteredResources.map((resource, idx) => (
                        <button
                          key={resource.id}
                          type="button"
                          className={`flex items-center gap-3 p-4 w-full text-left hover:bg-accent transition-colors cursor-pointer ${
                            selectedResource?.id === resource.id ? "bg-accent/50" : ""
                          }`}
                          onClick={() => {
                            toggleResource(provider, resource, rawResources[idx]!);
                            if (selectedResource?.id !== resource.id) setShowPicker(false);
                          }}
                        >
                          {renderIcon(resource)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{resource.name}</span>
                              {resource.badge && (
                                <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded shrink-0">
                                  {resource.badge}
                                </span>
                              )}
                            </div>
                            {resource.subtitle && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {resource.subtitle}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Missing a {resourceLabel.replace(/s$/, "")}?{" "}
                  <button
                    onClick={handleAdjustPermissions ?? handleConnect}
                    className="text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
                  >
                    {handleAdjustPermissions
                      ? `Adjust ${display.displayName} permissions \u2192`
                      : `Reconnect ${display.displayName} \u2192`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
