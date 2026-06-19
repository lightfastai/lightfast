import { useAuth } from "@clerk/tanstack-react-start";
import {
  Loading03Icon as Loader2,
  PlayIcon as Play,
  Delete02Icon as Trash,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { useState } from "react";
import {
  AUTOMATION_RUNS_PAGE_LIMIT,
  type Automation,
} from "./automations-cache";
import {
  automationDeleteMutationOptions,
  automationRunNowMutationOptions,
} from "./automations-mutations";
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
            <HugeiconsIcon className="size-4 animate-spin" icon={Loader2} />
          ) : (
            <HugeiconsIcon className="size-4" icon={Play} />
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
              <HugeiconsIcon className="size-4 animate-spin" icon={Loader2} />
            ) : (
              <HugeiconsIcon className="size-4" icon={Trash} />
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
                  <HugeiconsIcon
                    className="size-4 animate-spin"
                    icon={Loader2}
                  />
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
