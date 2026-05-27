"use client";

import type { AppRouterOutputs } from "@api/app";
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
import { useAuth } from "@vendor/clerk";
import { Loader2, Play, Trash } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { removeFromList } from "../../_components/automations-cache";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

function getSlug(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] ?? "workspace";
}

export function AutomationActions({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });

  if (!canManage) return null;

  return <AutomationActionsInner automation={automation} />;
}

function AutomationActionsInner({ automation }: { automation: Automation }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const qc = useQueryClient();
  const trpc = useTRPC();
  const router = useRouter();
  const slug = getSlug(usePathname());
  const id = automation.publicId;

  const listKey = trpc.org.workspace.automations.list.queryOptions().queryKey;
  const getKey = trpc.org.workspace.automations.get.queryOptions({ id }).queryKey;
  const listRunsKey = trpc.org.workspace.automations.listRuns.queryOptions({
    id,
    limit: 20,
  }).queryKey;

  const runNowMutation = useMutation(
    trpc.org.workspace.automations.runNow.mutationOptions({
      meta: { errorTitle: "Failed to enqueue run" },
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: listRunsKey });
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.org.workspace.automations.delete.mutationOptions({
      meta: { errorTitle: "Failed to delete automation" },
      onMutate: async () => {
        await Promise.all([
          qc.cancelQueries({ queryKey: listKey }),
          qc.cancelQueries({ queryKey: getKey }),
        ]);
        const prevList = qc.getQueryData(listKey);
        const prevGet = qc.getQueryData(getKey);
        removeFromList(qc, trpc, id);
        return { prevList, prevGet };
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.prevList) qc.setQueryData(listKey, ctx.prevList);
        if (ctx?.prevGet) qc.setQueryData(getKey, ctx.prevGet);
      },
      onSuccess: () => {
        router.push(`/${slug}/automations` as Route);
      },
    }),
  );

  return (
    <>
      <div className="space-y-2 border-border border-t pt-4">
        <Button
          className="w-full justify-start gap-2"
          disabled={
            runNowMutation.isPending || automation.status === "paused"
          }
          onClick={() => runNowMutation.mutate({ id })}
          size="sm"
          variant="secondary"
        >
          {runNowMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Run now
        </Button>
        <Button
          className="w-full justify-start gap-2"
          disabled={deleteMutation.isPending}
          onClick={() => setDeleteOpen(true)}
          size="sm"
          variant="secondary"
        >
          <Trash className="size-4" />
          Delete
        </Button>
      </div>

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteOpen(false);
                deleteMutation.mutate({ id });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
