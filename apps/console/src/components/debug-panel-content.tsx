"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { EVENT_REGISTRY, PROVIDERS } from "@repo/console-providers";
import { PROVIDER_DISPLAY } from "@repo/console-providers/display";
import { ProviderIcon } from "~/lib/provider-icon";
import { getResourceLabel } from "~/lib/resource-label";
import type { SourceType } from "@repo/console-providers";
import { ChevronDown, ChevronRight, Loader2, Check, X } from "lucide-react";

interface InjectionResult {
  eventKey: string;
  success: boolean;
  message: string;
}

interface EventItem {
  key: string;
  label: string;
}

// Get events grouped by category for a given source type
function getEventsForSource(sourceType: SourceType): {
  categories: Record<string, { label: string }>;
  eventsByCategory: Record<string, EventItem[]>;
} {
  const categories = PROVIDERS[sourceType].categories as Record<string, { label: string }>;
  const eventsByCategory: Record<string, EventItem[]> = {};

  for (const [eventKey, eventDef] of Object.entries(EVENT_REGISTRY)) {
    if (eventDef.source !== sourceType) continue;
    const cat = eventDef.category;
    eventsByCategory[cat] ??= [];
    eventsByCategory[cat].push({ key: eventKey, label: eventDef.label });
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
  const [expandedProvider, setExpandedProvider] = useState<SourceType | null>(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [injecting, setInjecting] = useState<string | null>(null);
  const [result, setResult] = useState<InjectionResult | null>(null);

  const { data: sourcesData, isLoading } = useQuery({
    ...trpc.workspace.sources.list.queryOptions({ clerkOrgSlug: slug, workspaceName }),
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
    {},
  );

  const selectedIntegration = integrations.find((i) => i.id === selectedIntegrationId);

  async function handleInject(integrationId: string, eventKey: string) {
    setInjecting(eventKey);
    setResult(null);
    try {
      const res = await fetch("/api/debug/inject-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, eventKey, context: context || undefined }),
      });
      const data = (await res.json()) as { deliveryId?: string; error?: string };
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
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading sources…
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="px-3 py-4 text-white/40 text-center">
        No sources connected to this workspace.
      </div>
    );
  }

  const selectedSourceType = selectedIntegration?.sourceType;
  const { categories, eventsByCategory } = selectedSourceType
    ? getEventsForSource(selectedSourceType)
    : { categories: {} as Record<string, { label: string }>, eventsByCategory: {} as Record<string, EventItem[]> };

  return (
    <div className="max-h-96 overflow-y-auto">
      {/* Context input */}
      <div className="px-3 pt-2.5 pb-2 border-b border-white/10">
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional context for AI generation…"
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/80 placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20 text-xs"
        />
      </div>

      {/* Provider list */}
      <div className="divide-y divide-white/5">
        {(Object.keys(byProvider) as SourceType[]).map((providerKey) => {
          const providerIntegrations = byProvider[providerKey] ?? [];
          const display = PROVIDER_DISPLAY[providerKey];
          const isExpanded = expandedProvider === providerKey;

          return (
            <div key={providerKey}>
              <button
                onClick={() => {
                  setExpandedProvider(isExpanded ? null : providerKey);
                  setSelectedIntegrationId(null);
                  setExpandedCategory(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-white/40 shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-white/40 shrink-0" />
                )}
                <ProviderIcon icon={display.icon} className="w-3.5 h-3.5 text-white/70 shrink-0" />
                <span className="text-white/80 flex-1 text-left">{display.displayName}</span>
                <span className="text-white/30">{providerIntegrations.length}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5">
                  {/* Integration list */}
                  {providerIntegrations.map((integration) => {
                    const label = getResourceLabel(integration.metadata);
                    const isSelected = selectedIntegrationId === integration.id;

                    return (
                      <button
                        key={integration.id}
                        onClick={() => {
                          setSelectedIntegrationId(isSelected ? null : integration.id);
                          setExpandedCategory(null);
                        }}
                        className={`w-full flex items-center gap-2 px-5 py-1.5 hover:bg-white/5 transition-colors ${isSelected ? "bg-white/8 text-white" : "text-white/60"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-yellow-400" : "bg-white/20"}`}
                        />
                        <span className="flex-1 text-left truncate">{label}</span>
                      </button>
                    );
                  })}

                  {/* Event type selector for selected integration */}
                  {selectedIntegration?.sourceType === providerKey && (
                    <div className="border-t border-white/5 bg-white/3">
                      {Object.keys(eventsByCategory).map((catKey) => {
                        const catDef = categories[catKey];
                        const events = eventsByCategory[catKey] ?? [];
                        if (events.length === 0) return null;
                        const isCatExpanded = expandedCategory === catKey;

                        return (
                          <div key={catKey}>
                            <button
                              onClick={() =>
                                setExpandedCategory(isCatExpanded ? null : catKey)
                              }
                              className="w-full flex items-center gap-2 px-6 py-1.5 hover:bg-white/5 transition-colors"
                            >
                              {isCatExpanded ? (
                                <ChevronDown className="w-3 h-3 text-white/30 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-white/30 shrink-0" />
                              )}
                              <span className="text-white/50 text-left">
                                {catDef?.label ?? catKey}
                              </span>
                            </button>

                            {isCatExpanded && (
                              <div>
                                {events.map((event: EventItem) => {
                                  const isInjecting = injecting === event.key;
                                  const matchedResult =
                                    result?.eventKey === event.key ? result : null;

                                  return (
                                    <div
                                      key={event.key}
                                      className="flex items-center gap-2 px-7 py-1 hover:bg-white/5"
                                    >
                                      <span className="flex-1 text-white/60 truncate">
                                        {event.label}
                                      </span>
                                      {matchedResult ? (
                                        matchedResult.success ? (
                                          <div className="flex items-center gap-1 text-green-400">
                                            <Check className="w-3 h-3" />
                                            <span className="text-xs truncate max-w-20">
                                              {matchedResult.message}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 text-red-400">
                                            <X className="w-3 h-3" />
                                            <span className="text-xs truncate max-w-20">
                                              {matchedResult.message}
                                            </span>
                                          </div>
                                        )
                                      ) : (
                                        <button
                                          onClick={() => {
                                            if (selectedIntegrationId) {
                                              void handleInject(selectedIntegrationId, event.key);
                                            }
                                          }}
                                          disabled={injecting !== null}
                                          className="px-2 py-0.5 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        >
                                          {isInjecting ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
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
