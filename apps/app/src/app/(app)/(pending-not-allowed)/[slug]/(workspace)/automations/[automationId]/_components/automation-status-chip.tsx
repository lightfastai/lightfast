"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Check, Circle, CirclePause } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { setOne, upsertInList } from "../../_components/automations-cache";
import { RailSection } from "./rail-section";

type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];

function StatusChipContent({ status }: { status: string }) {
  const Icon = status === "paused" ? CirclePause : Circle;
  return (
    <div className="flex items-center gap-2">
      <Icon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
        strokeWidth={2}
      />
      <span className="text-foreground text-sm capitalize">{status}</span>
    </div>
  );
}

export function AutomationStatusChip({
  automation,
}: {
  automation: Automation;
}) {
  const { has, isLoaded } = useAuth();
  const canManage = isLoaded && !!has?.({ role: "org:admin" });
  const [open, setOpen] = useState(false);

  const qc = useQueryClient();
  const trpc = useTRPC();
  const id = automation.publicId;
  const isPaused = automation.status === "paused";

  const pauseMutation = useMutation(
    trpc.org.workspace.automations.pause.mutationOptions({
      meta: { errorTitle: "Failed to pause" },
      onMutate: async () => {
        const getKey = trpc.org.workspace.automations.get.queryOptions({
          id,
        }).queryKey;
        const listKey =
          trpc.org.workspace.automations.list.queryOptions().queryKey;
        await Promise.all([
          qc.cancelQueries({ queryKey: getKey }),
          qc.cancelQueries({ queryKey: listKey }),
        ]);
        const prevGet = qc.getQueryData(getKey);
        const prevList = qc.getQueryData(listKey);
        setOne(qc, trpc, id, (a) => ({ ...a!, status: "paused" }));
        upsertInList(qc, trpc, id, (a) => ({ ...a!, status: "paused" }));
        return { prevGet, prevList };
      },
      onError: (_e, _v, ctx) => {
        const getKey = trpc.org.workspace.automations.get.queryOptions({
          id,
        }).queryKey;
        const listKey =
          trpc.org.workspace.automations.list.queryOptions().queryKey;
        if (ctx?.prevGet) {
          qc.setQueryData(getKey, ctx.prevGet);
        }
        if (ctx?.prevList) {
          qc.setQueryData(listKey, ctx.prevList);
        }
      },
      onSuccess: (updated) => {
        setOne(qc, trpc, id, () => updated);
        upsertInList(qc, trpc, id, () => updated);
      },
    })
  );

  const resumeMutation = useMutation(
    trpc.org.workspace.automations.resume.mutationOptions({
      meta: { errorTitle: "Failed to resume" },
      onMutate: async () => {
        const getKey = trpc.org.workspace.automations.get.queryOptions({
          id,
        }).queryKey;
        const listKey =
          trpc.org.workspace.automations.list.queryOptions().queryKey;
        await Promise.all([
          qc.cancelQueries({ queryKey: getKey }),
          qc.cancelQueries({ queryKey: listKey }),
        ]);
        const prevGet = qc.getQueryData(getKey);
        const prevList = qc.getQueryData(listKey);
        setOne(qc, trpc, id, (a) => ({ ...a!, status: "active" }));
        upsertInList(qc, trpc, id, (a) => ({ ...a!, status: "active" }));
        return { prevGet, prevList };
      },
      onError: (_e, _v, ctx) => {
        const getKey = trpc.org.workspace.automations.get.queryOptions({
          id,
        }).queryKey;
        const listKey =
          trpc.org.workspace.automations.list.queryOptions().queryKey;
        if (ctx?.prevGet) {
          qc.setQueryData(getKey, ctx.prevGet);
        }
        if (ctx?.prevList) {
          qc.setQueryData(listKey, ctx.prevList);
        }
      },
      onSuccess: (updated) => {
        setOne(qc, trpc, id, () => updated);
        upsertInList(qc, trpc, id, () => updated);
      },
    })
  );

  const isMutating = pauseMutation.isPending || resumeMutation.isPending;

  if (!canManage) {
    return (
      <RailSection label="Status">
        <StatusChipContent status={automation.status} />
      </RailSection>
    );
  }

  return (
    <RailSection label="Status">
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-auto gap-2 px-0 py-0 font-normal hover:bg-transparent"
            variant="ghost"
          >
            <StatusChipContent status={automation.status} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuItem
            disabled={isMutating}
            onSelect={() => {
              if (isPaused) {
                resumeMutation.mutate({ id });
              }
            }}
          >
            <span className={`flex-1 ${isPaused ? "" : "font-semibold"}`}>
              Active
            </span>
            {!isPaused && (
              <Check
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isMutating}
            onSelect={() => {
              if (!isPaused) {
                pauseMutation.mutate({ id });
              }
            }}
          >
            <span className={`flex-1 ${isPaused ? "font-semibold" : ""}`}>
              Paused
            </span>
            {isPaused && (
              <Check
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </RailSection>
  );
}
