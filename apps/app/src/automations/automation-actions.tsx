import type { AppRouterOutputs } from "@api/app";
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
import {
  Loading03Icon as Loader2,
  PlayIcon as Play,
  Delete02Icon as Trash,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import {
  AUTOMATION_RUNS_PAGE_LIMIT,
  removeFromList,
  upsertRun,
} from "./automations-cache";
import { RailSection } from "./detail-sections";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

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
  const trpc = useTRPC();
  const id = automation.publicId;

  const getKey = trpc.org.workspace.automations.get.queryOptions({
    id,
  }).queryKey;
  const listKey = trpc.org.workspace.automations.list.queryOptions().queryKey;
  const listRunsKey = trpc.org.workspace.automations.listRuns.queryOptions({
    id,
    limit: AUTOMATION_RUNS_PAGE_LIMIT,
  }).queryKey;

  const runNowMutation = useMutation(
    trpc.org.workspace.automations.runNow.mutationOptions({
      meta: { errorTitle: "Failed to enqueue run" },
      onSuccess: (run) => {
        upsertRun(qc, trpc, id, run);
        void qc.invalidateQueries({ queryKey: listRunsKey });
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.org.workspace.automations.delete.mutationOptions({
      meta: { errorTitle: "Failed to delete automation" },
      onMutate: async () => {
        await Promise.all([
          qc.cancelQueries({ queryKey: getKey }),
          qc.cancelQueries({ queryKey: listKey }),
        ]);
        const prevGet = qc.getQueryData(getKey);
        const prevList = qc.getQueryData(listKey);
        removeFromList(qc, trpc, id);
        return { prevGet, prevList };
      },
      onError: (_error, _variables, ctx) => {
        if (ctx?.prevGet) {
          qc.setQueryData(getKey, ctx.prevGet);
        }
        if (ctx?.prevList) {
          qc.setQueryData(listKey, ctx.prevList);
        }
      },
      onSuccess: async () => {
        setDeleteDialogOpen(false);
        await navigate({
          params: { slug },
          to: "/$slug/automations",
        });
        qc.removeQueries({ queryKey: getKey });
        void qc.invalidateQueries({ queryKey: listKey });
      },
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
            <HugeiconsIcon icon={Loader2} className="size-4 animate-spin" />
          ) : (
            <HugeiconsIcon icon={Play} className="size-4" />
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
              <HugeiconsIcon icon={Loader2} className="size-4 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Trash} className="size-4" />
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
                  <HugeiconsIcon icon={Loader2} className="size-4 animate-spin" />
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
