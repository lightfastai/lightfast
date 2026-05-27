import type { Automation, AutomationRun } from "@db/app/schema";
import type { QueryClient } from "@tanstack/react-query";
import type { useTRPC } from "~/trpc/react";

type TRPCClient = ReturnType<typeof useTRPC>;

export function upsertInList(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  transform: (prev?: Automation) => Automation,
): void {
  const key = trpc.org.workspace.automations.list.queryOptions().queryKey;
  qc.setQueryData(key, (old: Automation[] | undefined) => {
    const list = old ?? [];
    const idx = list.findIndex((a) => a.publicId === id);
    if (idx === -1) return [...list, transform(undefined)];
    const updated = [...list];
    updated[idx] = transform(list[idx]);
    return updated;
  });
}

export function setOne(
  qc: QueryClient,
  trpc: TRPCClient,
  id: string,
  transform: (prev?: Automation) => Automation,
): void {
  const key = trpc.org.workspace.automations.get.queryOptions({ id }).queryKey;
  qc.setQueryData(key, (old: Automation | undefined) => transform(old));
}

export function setRuns(
  qc: QueryClient,
  trpc: TRPCClient,
  automationId: string,
  transform: (prev?: AutomationRun[]) => AutomationRun[],
): void {
  const key = trpc.org.workspace.automations.listRuns.queryOptions({
    id: automationId,
    limit: 20,
  }).queryKey;
  qc.setQueryData(key, (old: AutomationRun[] | undefined) => transform(old));
}
