"use client";

import type { CategoryDef, ProviderSlug } from "@repo/console-providers/client";
import {
  EVENT_LABELS,
  PROVIDER_CATEGORIES,
  PROVIDER_DISPLAY,
} from "@repo/console-providers/client";
import { useTRPC } from "@repo/console-trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { useState } from "react";
import { ProviderIcon } from "~/lib/provider-icon";

interface InjectionResult {
  eventKey: string;
  message: string;
  success: boolean;
}

interface EventItem {
  key: string;
  label: string;
}

// Get events grouped by category for a given source type
function getEventsForSource(sourceType: ProviderSlug): {
  categories: Record<string, CategoryDef>;
  eventsByCategory: Record<string, EventItem[]>;
} {
  const categories = PROVIDER_CATEGORIES[sourceType] ?? {};
  const eventsByCategory: Record<string, EventItem[]> = {};
  const prefix = `${sourceType}:`;

  for (const [fullKey, label] of Object.entries(EVENT_LABELS)) {
    if (!fullKey.startsWith(prefix)) {
      continue;
    }
    const eventKey = fullKey.slice(prefix.length);
    for (const catKey of Object.keys(categories)) {
      if (eventKey === catKey || eventKey.startsWith(`${catKey}.`)) {
        eventsByCategory[catKey] ??= [];
        eventsByCategory[catKey].push({ key: fullKey, label });
        break;
      }
    }
  }

  return { categories, eventsByCategory };
}

export function DebugPanelContent({
  slug,
  workspaceName,
}: {
  slug: string;
  workspaceName: string;
}) {
  const trpc = useTRPC();
  const [expandedProvider, setExpandedProvider] = useState<ProviderSlug | null>(
    null
  );
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [injecting, setInjecting] = useState<string | null>(null);
  const [result, setResult] = useState<InjectionResult | null>(null);

  const { data: sourcesData, isLoading } = useQuery({
    ...trpc.workspace.sources.list.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  const integrations = sourcesData?.list ?? [];

  // Group by provider
  const byProvider = integrations.reduce<Record<string, typeof integrations>>(
    (acc, integration) => {
      const key = integration.sourceType;
      acc[key] ??= [];
      acc[key].push(integration);
      return acc;
    },
    {}
  );

  const selectedIntegration = integrations.find(
    (i) => i.id === selectedIntegrationId
  );

  async function handleInject(integrationId: string, eventKey: string) {
    setInjecting(eventKey);
    setResult(null);
    try {
      const res = await fetch("/api/debug/inject-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId,
          eventKey,
          context: context || undefined,
        }),
      });
      const data = (await res.json()) as {
        deliveryId?: string;
        error?: string;
      };
      setResult({
        eventKey,
        success: res.ok,
        message: data.deliveryId ?? data.error ?? "unknown",
      });
    } catch (err) {
      setResult({ eventKey, success: false, message: String(err) });
    } finally {
      setInjecting(null);
      setTimeout(() => setResult(null), 3000);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-white/50">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading sources…
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-white/40">
        No sources connected to this workspace.
      </div>
    );
  }

  const selectedSourceType = selectedIntegration?.sourceType as
    | ProviderSlug
    | undefined;
  const { categories, eventsByCategory } = selectedSourceType
    ? getEventsForSource(selectedSourceType)
    : {
        categories: {} as Record<string, CategoryDef>,
        eventsByCategory: {} as Record<string, EventItem[]>,
      };

  return (
    <div className="max-h-96 overflow-y-auto">
      {/* Context input */}
      <div className="border-white/10 border-b px-3 pt-2.5 pb-2">
        <textarea
          className="w-full resize-none rounded border border-white/10 bg-white/5 px-2 py-1.5 text-white/80 text-xs placeholder:text-white/30 focus:border-white/20 focus:outline-none"
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional context for AI generation…"
          rows={2}
          value={context}
        />
      </div>

      {/* Provider list */}
      <div className="divide-y divide-white/5">
        {(Object.keys(byProvider) as ProviderSlug[]).map((providerKey) => {
          const providerIntegrations = byProvider[providerKey] ?? [];
          const display = PROVIDER_DISPLAY[providerKey];
          const isExpanded = expandedProvider === providerKey;

          return (
            <div key={providerKey}>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-white/5"
                onClick={() => {
                  setExpandedProvider(isExpanded ? null : providerKey);
                  setSelectedIntegrationId(null);
                  setExpandedCategory(null);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-white/40" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-white/40" />
                )}
                <ProviderIcon
                  className="h-3.5 w-3.5 shrink-0 text-white/70"
                  icon={display.icon}
                />
                <span className="flex-1 text-left text-white/80">
                  {display.displayName}
                </span>
                <span className="text-white/30">
                  {providerIntegrations.length}
                </span>
              </button>

              {isExpanded && (
                <div className="border-white/5 border-t">
                  {/* Integration list */}
                  {providerIntegrations.map((integration) => {
                    const label = integration.displayName;
                    const isSelected = selectedIntegrationId === integration.id;

                    return (
                      <button
                        className={`flex w-full items-center gap-2 px-5 py-1.5 transition-colors hover:bg-white/5 ${isSelected ? "bg-white/8 text-white" : "text-white/60"}`}
                        key={integration.id}
                        onClick={() => {
                          setSelectedIntegrationId(
                            isSelected ? null : integration.id
                          );
                          setExpandedCategory(null);
                        }}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-yellow-400" : "bg-white/20"}`}
                        />
                        <span className="flex-1 truncate text-left">
                          {label}
                        </span>
                      </button>
                    );
                  })}

                  {/* Event type selector for selected integration */}
                  {selectedIntegration?.sourceType === providerKey && (
                    <div className="border-white/5 border-t bg-white/3">
                      {Object.keys(eventsByCategory).map((catKey) => {
                        const catDef = categories[catKey];
                        const events = eventsByCategory[catKey] ?? [];
                        if (events.length === 0) {
                          return null;
                        }
                        const isCatExpanded = expandedCategory === catKey;

                        return (
                          <div key={catKey}>
                            <button
                              className="flex w-full items-center gap-2 px-6 py-1.5 transition-colors hover:bg-white/5"
                              onClick={() =>
                                setExpandedCategory(
                                  isCatExpanded ? null : catKey
                                )
                              }
                            >
                              {isCatExpanded ? (
                                <ChevronDown className="h-3 w-3 shrink-0 text-white/30" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0 text-white/30" />
                              )}
                              <span className="text-left text-white/50">
                                {catDef?.label ?? catKey}
                              </span>
                            </button>

                            {isCatExpanded && (
                              <div>
                                {events.map((event: EventItem) => {
                                  const isInjecting = injecting === event.key;
                                  const matchedResult =
                                    result?.eventKey === event.key
                                      ? result
                                      : null;

                                  return (
                                    <div
                                      className="flex items-center gap-2 px-7 py-1 hover:bg-white/5"
                                      key={event.key}
                                    >
                                      <span className="flex-1 truncate text-white/60">
                                        {event.label}
                                      </span>
                                      {matchedResult ? (
                                        matchedResult.success ? (
                                          <div className="flex items-center gap-1 text-green-400">
                                            <Check className="h-3 w-3" />
                                            <span className="max-w-20 truncate text-xs">
                                              {matchedResult.message}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 text-red-400">
                                            <X className="h-3 w-3" />
                                            <span className="max-w-20 truncate text-xs">
                                              {matchedResult.message}
                                            </span>
                                          </div>
                                        )
                                      ) : (
                                        <button
                                          className="flex items-center gap-1 rounded bg-yellow-400/20 px-2 py-0.5 text-yellow-300 transition-colors hover:bg-yellow-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                                          disabled={injecting !== null}
                                          onClick={() => {
                                            if (selectedIntegrationId) {
                                              void handleInject(
                                                selectedIntegrationId,
                                                event.key
                                              );
                                            }
                                          }}
                                        >
                                          {isInjecting ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            "Inject"
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
