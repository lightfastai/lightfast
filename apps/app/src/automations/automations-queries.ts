import {
  type AutomationRunDetailResult,
  type CreateAutomationResult,
  createAutomation,
  deleteAutomation,
  getAutomation,
  getAutomationRun,
  type ListAutomationRunsResult,
  type ListAutomationsResult,
  listAutomationRuns,
  listAutomations,
  pauseAutomation,
  resumeAutomation,
  runAutomationNow,
  updateAutomation,
} from "@api/app/tanstack/automations";
import type {
  CreateAutomationInput,
  UpdateAutomationInput,
} from "@repo/app-validation/schemas";
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import {
  AUTOMATION_RUNS_PAGE_LIMIT,
  type Automation,
  applyAutomationPatch,
  automationMutationKeys,
  automationQueryKeys,
  removeFromList,
  setOne,
  upsertInList,
  upsertRun,
} from "./automations-cache";

export type AutomationList = ListAutomationsResult;
export type AutomationListItem = AutomationList[number];
export type AutomationRunList = ListAutomationRunsResult;
export type AutomationRunListItem = AutomationRunList[number];
export type AutomationRunDetail = AutomationRunDetailResult;

export {
  AUTOMATION_RUNS_PAGE_LIMIT,
  automationMutationKeys,
} from "./automations-cache";

export function automationsListQueryOptions(
  input: { enabled?: boolean; staleTime?: number } = {}
) {
  return queryOptions({
    enabled: input.enabled,
    queryFn: () => listAutomations(),
    queryKey: automationQueryKeys.list(),
    staleTime: input.staleTime ?? 30_000,
  });
}

export function automationDetailQueryOptions(input: {
  enabled?: boolean;
  id: string;
  staleTime?: number;
}) {
  return queryOptions({
    enabled: input.enabled,
    queryFn: () => getAutomation({ data: { id: input.id } }),
    queryKey: automationQueryKeys.detail(input.id),
    staleTime: input.staleTime ?? 30_000,
  });
}

export function automationRunsQueryOptions(input: {
  enabled?: boolean;
  id: string;
  limit?: number;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
}) {
  const limit = input.limit ?? AUTOMATION_RUNS_PAGE_LIMIT;
  return queryOptions({
    enabled: input.enabled,
    queryFn: () => listAutomationRuns({ data: { id: input.id, limit } }),
    queryKey: automationQueryKeys.runs(input.id, limit),
    refetchOnWindowFocus: input.refetchOnWindowFocus,
    staleTime: input.staleTime ?? 5000,
  });
}

export function automationRunQueryOptions(input: {
  enabled?: boolean;
  id: string;
  refetchOnWindowFocus?: boolean;
  retry?: false | number;
  staleTime?: number;
}) {
  return queryOptions({
    enabled: input.enabled,
    queryFn: () => getAutomationRun({ data: { id: input.id } }),
    queryKey: automationQueryKeys.run(input.id),
    refetchOnWindowFocus: input.refetchOnWindowFocus,
    retry: input.retry,
    staleTime: input.staleTime ?? 5000,
  });
}

export function automationCreateMutationOptions(input: {
  onSuccess?: (automation: CreateAutomationResult) => Promise<void> | void;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to create automation" },
    mutationFn: (data: CreateAutomationInput) => createAutomation({ data }),
    onSuccess: async (automation) => {
      upsertInList(input.queryClient, automation.publicId, () => automation);
      setOne(input.queryClient, automation.publicId, () => automation);
      await input.onSuccess?.(automation);
    },
  });
}

export function automationUpdateMutationOptions(
  qc: QueryClient,
  id: string,
  opts: { errorTitle: string }
) {
  const getKey = automationQueryKeys.detail(id);
  const listKey = automationQueryKeys.list();

  return mutationOptions({
    meta: { errorTitle: opts.errorTitle },
    mutationFn: (patch: UpdateAutomationInput) =>
      updateAutomation({ data: { ...patch, id } }),
    mutationKey: automationMutationKeys.update(),
    onMutate: async (patch) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: getKey }),
        qc.cancelQueries({ queryKey: listKey }),
      ]);
      const prevGet = qc.getQueryData(getKey);
      const prevList = qc.getQueryData(listKey);
      const patchCachedAutomation = (automation?: Automation) =>
        automation ? applyAutomationPatch(automation, patch) : undefined;
      setOne(qc, id, patchCachedAutomation);
      upsertInList(qc, id, patchCachedAutomation);
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
      setOne(qc, id, () => updated);
      upsertInList(qc, id, () => updated);
    },
  });
}

export function automationPauseMutationOptions(input: {
  automation: Automation;
  queryClient: QueryClient;
}) {
  return automationStatusMutationOptions({
    automation: input.automation,
    errorTitle: "Failed to pause",
    mutationFn: (data) => pauseAutomation({ data }),
    queryClient: input.queryClient,
    status: "paused",
  });
}

export function automationResumeMutationOptions(input: {
  automation: Automation;
  queryClient: QueryClient;
}) {
  return automationStatusMutationOptions({
    automation: input.automation,
    errorTitle: "Failed to resume",
    mutationFn: (data) => resumeAutomation({ data }),
    queryClient: input.queryClient,
    status: "active",
  });
}

export function automationRunNowMutationOptions(input: {
  automationId: string;
  limit?: number;
  queryClient: QueryClient;
}) {
  const limit = input.limit ?? AUTOMATION_RUNS_PAGE_LIMIT;
  return mutationOptions({
    meta: { errorTitle: "Failed to enqueue run" },
    mutationFn: (data: { id: string }) => runAutomationNow({ data }),
    onSuccess: (run) => {
      upsertRun(input.queryClient, input.automationId, run, limit);
      void input.queryClient.invalidateQueries({
        queryKey: automationQueryKeys.runs(input.automationId, limit),
      });
    },
  });
}

export function automationDeleteMutationOptions(input: {
  onSuccess?: () => Promise<void> | void;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to delete automation" },
    mutationFn: (data: { id: string }) => deleteAutomation({ data }),
    onMutate: async (data) => {
      const getKey = automationQueryKeys.detail(data.id);
      const listKey = automationQueryKeys.list();
      await Promise.all([
        input.queryClient.cancelQueries({ queryKey: getKey }),
        input.queryClient.cancelQueries({ queryKey: listKey }),
      ]);
      const prevGet = input.queryClient.getQueryData(getKey);
      const prevList = input.queryClient.getQueryData(listKey);
      removeFromList(input.queryClient, data.id);
      return { getKey, listKey, prevGet, prevList };
    },
    onError: (_error, _variables, ctx) => {
      if (ctx?.prevGet) {
        input.queryClient.setQueryData(ctx.getKey, ctx.prevGet);
      }
      if (ctx?.prevList) {
        input.queryClient.setQueryData(ctx.listKey, ctx.prevList);
      }
    },
    onSuccess: async (_result, data) => {
      await input.onSuccess?.();
      input.queryClient.removeQueries({
        queryKey: automationQueryKeys.detail(data.id),
      });
      void input.queryClient.invalidateQueries({
        queryKey: automationQueryKeys.list(),
      });
    },
  });
}

function automationStatusMutationOptions(input: {
  automation: Automation;
  errorTitle: string;
  mutationFn: (data: { id: string }) => Promise<Automation>;
  queryClient: QueryClient;
  status: Automation["status"];
}) {
  const id = input.automation.publicId;
  const getKey = automationQueryKeys.detail(id);
  const listKey = automationQueryKeys.list();
  const withStatus = (automation: Automation | undefined) => ({
    ...(automation ?? input.automation),
    status: input.status,
  });

  return mutationOptions({
    meta: { errorTitle: input.errorTitle },
    mutationFn: input.mutationFn,
    onMutate: async () => {
      await Promise.all([
        input.queryClient.cancelQueries({ queryKey: getKey }),
        input.queryClient.cancelQueries({ queryKey: listKey }),
      ]);
      const prevGet = input.queryClient.getQueryData(getKey);
      const prevList = input.queryClient.getQueryData(listKey);
      const hadPrevGet = input.queryClient.getQueryState(getKey) !== undefined;
      const hadPrevList =
        input.queryClient.getQueryState(listKey) !== undefined;
      setOne(input.queryClient, id, withStatus);
      upsertInList(input.queryClient, id, withStatus);
      return { hadPrevGet, hadPrevList, prevGet, prevList };
    },
    onError: (_error, _variables, ctx) => {
      if (ctx?.hadPrevGet) {
        input.queryClient.setQueryData(getKey, ctx.prevGet);
      } else {
        input.queryClient.removeQueries({ exact: true, queryKey: getKey });
      }
      if (ctx?.hadPrevList) {
        input.queryClient.setQueryData(listKey, ctx.prevList);
      } else {
        input.queryClient.removeQueries({ exact: true, queryKey: listKey });
      }
    },
    onSuccess: (updated) => {
      setOne(input.queryClient, id, () => updated);
      upsertInList(input.queryClient, id, () => updated);
    },
  });
}
