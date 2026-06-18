import type {
  AutomationDetailResult,
  ListAutomationRunsResult,
} from "@api/app/tanstack/automations";
import type { AutomationScheduleInput } from "@repo/app-validation/schemas";
import type { QueryClient } from "@tanstack/react-query";

export type Automation = AutomationDetailResult;
type AutomationRun = ListAutomationRunsResult[number];

export const AUTOMATION_RUNS_PAGE_LIMIT = 20;

export const automationQueryKeys = {
  all: ["automations"] as const,
  detail: (id: string) => ["automations", "detail", id] as const,
  list: () => ["automations", "list"] as const,
  run: (id: string) => ["automations", "run", id] as const,
  runs: (automationId: string, limit = AUTOMATION_RUNS_PAGE_LIMIT) =>
    ["automations", "runs", automationId, { limit }] as const,
};

export const automationMutationKeys = {
  all: ["automations", "mutation"] as const,
  update: () => ["automations", "mutation", "update"] as const,
};

export function upsertInList(
  qc: QueryClient,
  id: string,
  transform: (prev?: Automation) => Automation | undefined
): void {
  const key = automationQueryKeys.list();
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

export function removeFromList(qc: QueryClient, id: string): void {
  const key = automationQueryKeys.list();
  qc.setQueryData(key, (old: Automation[] | undefined) =>
    (old ?? []).filter((automation) => automation.publicId !== id)
  );
}

export function setOne(
  qc: QueryClient,
  id: string,
  transform: (prev?: Automation) => Automation | undefined
): void {
  const key = automationQueryKeys.detail(id);
  qc.setQueryData(key, (old: Automation | undefined) => transform(old));
}

function setRuns(
  qc: QueryClient,
  automationId: string,
  transform: (prev?: AutomationRun[]) => AutomationRun[],
  limit = AUTOMATION_RUNS_PAGE_LIMIT
): void {
  const key = automationQueryKeys.runs(automationId, limit);
  qc.setQueryData(key, (old: AutomationRun[] | undefined) => transform(old));
}

export function upsertRun(
  qc: QueryClient,
  automationId: string,
  run: AutomationRun,
  limit = AUTOMATION_RUNS_PAGE_LIMIT
): void {
  const getRunKey = automationQueryKeys.run(run.publicId);
  qc.setQueryData(getRunKey, run);
  setRuns(
    qc,
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
