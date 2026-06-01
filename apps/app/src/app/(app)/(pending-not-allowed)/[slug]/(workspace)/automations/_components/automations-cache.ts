import type { Automation, AutomationRun } from "@db/app/schema";
import type { QueryClient } from "@tanstack/react-query";
import type { useTRPC } from "~/trpc/react";

type TRPCClient = ReturnType<typeof useTRPC>;

export function upsertInList(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  transform: (prev?: Automation) => Automation
): void {
  const key = trpc.org.workspace.automations.list.queryOptions().queryKey;
  qc.setQueryData(key, (old: Automation[] | undefined) => {
    const list = old ?? [];
    const idx = list.findIndex((a) => a.publicId === id);
    if (idx === -1) {
      return [...list, transform(undefined)];
    }
    const updated = [...list];
    updated[idx] = transform(list[idx]);
    return updated;
  });
}

export function setOne(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  transform: (prev?: Automation) => Automation
): void {
  const key = trpc.org.workspace.automations.get.queryOptions({ id }).queryKey;
  qc.setQueryData(key, (old: Automation | undefined) => transform(old));
}

export function setRuns(
  qc: QueryClient,
  trpc: TRPCClient,
  automationId: string,
  transform: (prev?: AutomationRun[]) => AutomationRun[]
): void {
  const key = trpc.org.workspace.automations.listRuns.queryOptions({
    id: automationId,
    limit: 20,
  }).queryKey;
  qc.setQueryData(key, (old: AutomationRun[] | undefined) => transform(old));
}

export function applyAutomationPatch(
  prev: Automation,
  patch: { name?: string; prompt?: string }
): Automation {
  return {
    ...prev,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
  };
}

/**
 * Shared optimistic-update wiring for `automations.update`. Snapshots the get +
 * list caches, applies the patch optimistically, rolls back on error, and
 * replaces both caches with the server result on success.
 */
export function automationUpdateMutationOptions(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  opts: { errorTitle: string }
) {
  const getKey = trpc.org.workspace.automations.get.queryOptions({ id }).queryKey;
  const listKey = trpc.org.workspace.automations.list.queryOptions().queryKey;

  return trpc.org.workspace.automations.update.mutationOptions({
    meta: { errorTitle: opts.errorTitle },
    onMutate: async (patch) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: getKey }),
        qc.cancelQueries({ queryKey: listKey }),
      ]);
      const prevGet = qc.getQueryData(getKey);
      const prevList = qc.getQueryData(listKey);
      setOne(qc, trpc, id, (a) => applyAutomationPatch(a as Automation, patch));
      upsertInList(qc, trpc, id, (a) => applyAutomationPatch(a as Automation, patch));
      return { prevGet, prevList };
    },
    onError: (_error, _patch, ctx) => {
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
  });
}
