"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTRPC } from "@repo/console-trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GITHUB_EVENTS,
  VERCEL_EVENTS,
  LINEAR_EVENTS,
  SENTRY_EVENTS,
  ALL_GITHUB_EVENTS,
  ALL_VERCEL_EVENTS,
  ALL_LINEAR_EVENTS,
  ALL_SENTRY_EVENTS,
} from "@repo/console-types";

// Combined interface for event config
interface EventConfig {
  label: string;
  description: string;
  type: "observation" | "sync+observation";
}

interface EventSettingsProps {
  integrationId: string;
  provider: "github" | "vercel" | "linear" | "sentry";
  currentEvents: string[];
  clerkOrgSlug: string;
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
    provider === "github" ? ALL_GITHUB_EVENTS :
    provider === "vercel" ? ALL_VERCEL_EVENTS :
    provider === "linear" ? ALL_LINEAR_EVENTS :
    ALL_SENTRY_EVENTS;

  const eventConfig: Record<string, EventConfig> =
    provider === "github" ? GITHUB_EVENTS :
    provider === "vercel" ? VERCEL_EVENTS :
    provider === "linear" ? LINEAR_EVENTS :
    SENTRY_EVENTS;

  const getInitialEvents = () => {
    if (currentEvents.length === 0) {
      return allEvents as string[];
    }
    return currentEvents;
  };

  const [selectedEvents, setSelectedEvents] = useState<string[]>(() => getInitialEvents());
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = useMutation({
    ...trpc.workspace.integrations.updateEvents.mutationOptions(),
    onSuccess: () => {
      setHasChanges(false);
      void queryClient.invalidateQueries({
        queryKey: [["workspace", "sources", "list"], { input: { clerkOrgSlug, workspaceName }, type: "query" }],
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

  const showPushWarning = provider === "github" && !selectedEvents.includes("push");

  return (
    <div className="pt-3 pb-4 px-4 border-t border-border bg-muted/30">
      <div className="text-sm font-medium text-foreground mb-3">Event Subscriptions</div>

      {showPushWarning && (
        <Alert variant="destructive" className="mb-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Disabling push events will stop file syncing for this repository.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {allEvents.map((event) => {
          const config = eventConfig[event];
          if (!config) return null;
          return (
            <div key={event} className="flex items-start gap-3">
              <Checkbox
                id={`${integrationId}-${event}`}
                checked={selectedEvents.includes(event)}
                onCheckedChange={() => handleToggle(event)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label
                  htmlFor={`${integrationId}-${event}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {config.label}
                  {config.type === "sync+observation" && (
                    <span className="ml-2 text-xs text-muted-foreground">(sync + observation)</span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
