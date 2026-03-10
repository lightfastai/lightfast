"use client";

import type { CategoryDef, SourceType } from "@repo/console-providers";
import { BACKFILL_DEPTH_OPTIONS, PROVIDERS } from "@repo/console-providers";
import { useTRPC } from "@repo/console-trpc/react";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { Source } from "~/types";

interface SourceSettingsFormProps {
  backfillConfig: Source["backfillConfig"];
  currentEvents: string[];
  installationId: string;
  integrationId: string;
  provider: SourceType;
}

export function SourceSettingsForm({
  installationId,
  integrationId,
  provider,
  currentEvents,
  backfillConfig,
}: SourceSettingsFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const eventConfig = PROVIDERS[provider].categories;
  const allEventKeys = Object.keys(eventConfig);

  // Backwards compat: empty array = all events
  const activeEvents =
    currentEvents.length === 0 ? allEventKeys : currentEvents;
  const showPushWarning =
    provider === "github" && !activeEvents.includes("push");

  // Available entity types come from provider categories
  const availableEntityTypes = allEventKeys;

  // Backfill config state — initialize from stored config or select all as default
  type BackfillDepth = (typeof BACKFILL_DEPTH_OPTIONS)[number];
  const [depth, setDepth] = useState<BackfillDepth>(
    backfillConfig?.depth ?? 30
  );
  const [entityTypes, setEntityTypes] = useState<string[]>(
    backfillConfig?.entityTypes ?? availableEntityTypes
  );

  const initialDepth = backfillConfig?.depth ?? 30;
  const initialEntityTypes =
    backfillConfig?.entityTypes ?? availableEntityTypes;
  const isDirty =
    depth !== initialDepth ||
    JSON.stringify([...entityTypes].sort()) !==
      JSON.stringify([...initialEntityTypes].sort());

  const updateMutation = useMutation(
    trpc.connections.updateBackfillConfig.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [["workspace", "sources", "list"]],
        });
      },
    })
  );

  function toggleEntityType(type: string) {
    setEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleSave() {
    if (entityTypes.length === 0) {
      return;
    }
    updateMutation.mutate({
      installationId,
      backfillConfig: { depth, entityTypes },
    });
  }

  return (
    <div className="border-border/50 border-t bg-card/40 px-4 pt-3 pb-4">
      {/* Event Subscriptions */}
      <div className="mb-3 font-medium text-foreground text-sm">
        Event Subscriptions
      </div>

      {showPushWarning && (
        <Alert className="mb-3" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Push events are disabled — file syncing is stopped for this
            repository.
          </AlertDescription>
        </Alert>
      )}

      {/* 2-column event grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {(Object.entries(eventConfig) as [string, CategoryDef][]).map(
          ([event, config]) => (
            <div className="flex items-start gap-3" key={event}>
              <Checkbox
                checked={activeEvents.includes(event)}
                disabled
                id={`${integrationId}-${event}`}
              />
              <div className="grid gap-0.5 leading-none">
                <Label
                  className="font-medium text-sm"
                  htmlFor={`${integrationId}-${event}`}
                >
                  {config.label}
                  {config.type === "sync+observation" && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      (sync + observation)
                    </span>
                  )}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {config.description}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {/* Backfill Configuration */}
      <div className="mt-5 border-border/50 border-t pt-4">
        <div className="mb-3 font-medium text-foreground text-sm">
          Backfill Configuration
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-muted-foreground text-xs">Depth</p>
            <Select
              onValueChange={(v) => {
                const parsed = Number(v);
                const valid = BACKFILL_DEPTH_OPTIONS.find((d) => d === parsed);
                if (valid) {
                  setDepth(valid);
                }
              }}
              value={depth.toString()}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BACKFILL_DEPTH_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d.toString()}>
                    {d} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableEntityTypes.length > 0 && (
            <div>
              <p className="mb-1.5 text-muted-foreground text-xs">
                Entity Types
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableEntityTypes.map((type) => {
                  const active = entityTypes.includes(type);
                  return (
                    <Badge
                      className={cn(
                        "cursor-pointer select-none text-xs",
                        !active && "opacity-50"
                      )}
                      key={type}
                      onClick={() => toggleEntityType(type)}
                      variant={active ? "secondary" : "outline"}
                    >
                      {type}
                    </Badge>
                  );
                })}
              </div>
              {entityTypes.length === 0 && (
                <p className="mt-1 text-destructive text-xs">
                  At least one entity type must be selected.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              disabled={
                !isDirty || entityTypes.length === 0 || updateMutation.isPending
              }
              onClick={handleSave}
              size="sm"
              variant="outline"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
            {updateMutation.isSuccess && !isDirty && (
              <span className="text-muted-foreground text-xs">Saved</span>
            )}
            {updateMutation.isError && (
              <span className="text-destructive text-xs">Failed to save</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
