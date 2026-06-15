import type { AppRouterOutputs } from "@api/app";
import type { AutomationScheduleInput } from "@repo/app-validation/schemas";
import type { QueryClient } from "@tanstack/react-query";
import type { useTRPC } from "~/trpc/react";

type TRPCClient = ReturnType<typeof useTRPC>;
type Automation = AppRouterOutputs["org"]["workspace"]["automations"]["get"];
type AutomationRun =
  AppRouterOutputs["org"]["workspace"]["automations"]["listRuns"][number];

export const AUTOMATION_RUNS_PAGE_LIMIT = 20;

export function upsertInList(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  transform: (prev?: Automation) => Automation | undefined
): void {
  const key = trpc.org.workspace.automations.list.queryOptions().queryKey;
  qc.setQueryData(key, (old: Automation[] | undefined) => {
    const list = old ?? [];
    const idx = list.findIndex((automation) => automation.publicId === id);
    if (idx === -1) {
      const next = transform(undefined);
      return next ? [...list, next] : list;
    }
    const updated = [...list];
    const next = transform(list[idx]);
    if (!next) {
      return list;
    }
    updated[idx] = next;
    return updated;
  });
}

export function removeFromList(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string
): void {
  const key = trpc.org.workspace.automations.list.queryOptions().queryKey;
  qc.setQueryData(key, (old: Automation[] | undefined) =>
    (old ?? []).filter((automation) => automation.publicId !== id)
  );
}

export function setOne(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  transform: (prev?: Automation) => Automation | undefined
): void {
  const key = trpc.org.workspace.automations.get.queryOptions({ id }).queryKey;
  qc.setQueryData(key, (old: Automation | undefined) => transform(old));
}

export function setRuns(
  qc: QueryClient,
  trpc: TRPCClient,
  automationId: string,
  transform: (prev?: AutomationRun[]) => AutomationRun[],
  limit = AUTOMATION_RUNS_PAGE_LIMIT
): void {
  const key = trpc.org.workspace.automations.listRuns.queryOptions({
    id: automationId,
    limit,
  }).queryKey;
  qc.setQueryData(key, (old: AutomationRun[] | undefined) => transform(old));
}

export function upsertRun(
  qc: QueryClient,
  trpc: TRPCClient,
  automationId: string,
  run: AutomationRun,
  limit = AUTOMATION_RUNS_PAGE_LIMIT
): void {
  const getRunKey = trpc.org.workspace.automations.getRun.queryOptions({
    id: run.publicId,
  }).queryKey;
  qc.setQueryData(getRunKey, run);
  setRuns(
    qc,
    trpc,
    automationId,
    (old) => {
      const next = [
        run,
        ...(old ?? []).filter((item) => item.publicId !== run.publicId),
      ];
      return next.slice(0, limit);
    },
    limit
  );
}

export function applyAutomationPatch(
  prev: Automation,
  patch: {
    name?: string;
    prompt?: string;
    schedule?: AutomationScheduleInput;
    timezone?: string;
  }
): Automation {
  return {
    ...prev,
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.prompt === undefined ? {} : { prompt: patch.prompt }),
    ...(patch.schedule === undefined
      ? {}
      : {
          scheduleKind: patch.schedule.kind,
          scheduleConfig: patch.schedule.config as Automation["scheduleConfig"],
        }),
    ...(patch.timezone === undefined ? {} : { timezone: patch.timezone }),
  };
}

export function automationUpdateMutationOptions(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  opts: { errorTitle: string }
) {
  const getKey = trpc.org.workspace.automations.get.queryOptions({
    id,
  }).queryKey;
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
      const patchCachedAutomation = (automation?: Automation) =>
        automation ? applyAutomationPatch(automation, patch) : undefined;
      setOne(qc, trpc, id, patchCachedAutomation);
      upsertInList(qc, trpc, id, patchCachedAutomation);
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
