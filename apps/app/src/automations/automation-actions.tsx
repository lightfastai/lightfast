import { useAuth } from "@clerk/tanstack-react-start";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Play, Trash } from "lucide-react";
import { useState } from "react";
import type { Automation } from "./automations-cache";
import {
  AUTOMATION_RUNS_PAGE_LIMIT,
  automationDeleteMutationOptions,
  automationRunNowMutationOptions,
} from "./automations-queries";
import { RailSection } from "./detail-sections";

export function AutomationActions({
  automation,
  slug,
}: {
  automation: Automation;
  slug: string;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  if (!canManage) {
    return null;
  }

  return <AutomationActionsInner automation={automation} slug={slug} />;
}

function AutomationActionsInner({
  automation,
  slug,
}: {
  automation: Automation;
  slug: string;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const id = automation.publicId;

  const runNowMutation = useMutation(
    automationRunNowMutationOptions({
      automationId: id,
      limit: AUTOMATION_RUNS_PAGE_LIMIT,
      queryClient: qc,
    })
  );

  const deleteMutation = useMutation(
    automationDeleteMutationOptions({
      onSuccess: async () => {
        setDeleteDialogOpen(false);
        await navigate({
          params: { slug },
          to: "/$slug/automations",
        });
      },
      queryClient: qc,
    })
  );

  return (
    <RailSection title="Actions">
      <div className="space-y-2">
        <Button
          className="w-full justify-start gap-2"
          disabled={runNowMutation.isPending || automation.status === "paused"}
          onClick={() => runNowMutation.mutate({ id })}
          size="lf"
          variant="secondary"
        >
          {runNowMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Run now
        </Button>
        <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
          <Button
            className="w-full justify-start gap-2"
            disabled={deleteMutation.isPending}
            onClick={() => setDeleteDialogOpen(true)}
            size="lf"
            type="button"
            variant="secondary"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash className="size-4" />
            )}
            Delete
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete automation?</AlertDialogTitle>
              <AlertDialogDescription>
                "{automation.name}" will be removed from this workspace. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate({ id });
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RailSection>
  );
}
