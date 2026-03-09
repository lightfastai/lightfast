"use client";

import { useTRPC } from "@repo/console-trpc/react";
import {
  ALL_GITHUB_EVENTS,
  ALL_LINEAR_EVENTS,
  ALL_SENTRY_EVENTS,
  ALL_VERCEL_EVENTS,
  GITHUB_EVENTS,
  LINEAR_EVENTS,
  SENTRY_EVENTS,
  VERCEL_EVENTS,
} from "@repo/console-types";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

// Combined interface for event config
interface EventConfig {
  description: string;
  label: string;
  type: "observation" | "sync+observation";
}

interface EventSettingsProps {
  clerkOrgSlug: string;
  currentEvents: string[];
  integrationId: string;
  provider: "github" | "vercel" | "linear" | "sentry";
  workspaceName: string;
}

export function EventSettings({
  integrationId,
  provider,
  currentEvents,
  clerkOrgSlug,
  workspaceName,
}: EventSettingsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Determine which events are enabled
  // Empty array = all events enabled (backwards compat)
  const allEvents =
    provider === "github"
      ? ALL_GITHUB_EVENTS
      : provider === "vercel"
        ? ALL_VERCEL_EVENTS
        : provider === "linear"
          ? ALL_LINEAR_EVENTS
          : ALL_SENTRY_EVENTS;

  const eventConfig: Record<string, EventConfig> =
    provider === "github"
      ? GITHUB_EVENTS
      : provider === "vercel"
        ? VERCEL_EVENTS
        : provider === "linear"
          ? LINEAR_EVENTS
          : SENTRY_EVENTS;

  const getInitialEvents = () => {
    if (currentEvents.length === 0) {
      return allEvents as string[];
    }
    return currentEvents;
  };

  const [selectedEvents, setSelectedEvents] = useState<string[]>(() =>
    getInitialEvents()
  );
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = useMutation({
    ...trpc.workspace.integrations.updateEvents.mutationOptions(),
    onSuccess: () => {
      setHasChanges(false);
      void queryClient.invalidateQueries({
        queryKey: [
          ["workspace", "sources", "list"],
          { input: { clerkOrgSlug, workspaceName }, type: "query" },
        ],
      });
    },
  });

  const handleToggle = (event: string) => {
    setSelectedEvents((prev) => {
      const next = prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event];
      setHasChanges(true);
      return next;
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      integrationId,
      events: selectedEvents,
    });
  };

  const showPushWarning =
    provider === "github" && !selectedEvents.includes("push");

  return (
    <div className="border-border/50 border-t bg-card/40 px-4 pt-3 pb-4">
      <div className="mb-3 font-medium text-foreground text-sm">
        Event Subscriptions
      </div>

      {showPushWarning && (
        <Alert className="mb-3" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Disabling push events will stop file syncing for this repository.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {allEvents.map((event) => {
          const config = eventConfig[event];
          if (!config) {
            return null;
          }
          return (
            <div className="flex items-start gap-3" key={event}>
              <Checkbox
                checked={selectedEvents.includes(event)}
                id={`${integrationId}-${event}`}
                onCheckedChange={() => handleToggle(event)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label
                  className="cursor-pointer font-medium text-sm"
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
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          disabled={!hasChanges || updateMutation.isPending}
          onClick={handleSave}
          size="sm"
        >
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
