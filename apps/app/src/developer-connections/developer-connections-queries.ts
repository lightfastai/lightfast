import {
  type CompleteSentryDeveloperConnectionAuthInput,
  type ConnectDeveloperConnectionInput,
  completeSentryDeveloperConnectionAuth,
  connectDeveloperConnection,
  type DisconnectDeveloperConnectionInput,
  disconnectDeveloperConnection,
  listDeveloperConnections,
  type SetDeveloperConnectionSandboxEnabledInput,
  type StartSentryDeveloperConnectionAuthInput,
  type StartSentryDeveloperConnectionAuthResult,
  setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth,
} from "@api/app/tanstack/developer-connections";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

export const developerConnectionQueryKeys = {
  all: ["developer-connections"] as const,
  list: () => ["developer-connections", "list"] as const,
};

export function developerConnectionsQueryOptions(input?: {
  staleTime?: number;
}) {
  return queryOptions({
    queryFn: () => listDeveloperConnections(),
    queryKey: developerConnectionQueryKeys.list(),
    staleTime: input?.staleTime,
  });
}

export function connectDeveloperConnectionMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to connect developer provider" },
    mutationFn: (data: ConnectDeveloperConnectionInput) =>
      connectDeveloperConnection({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function startSentryDeveloperConnectionAuthMutationOptions(input?: {
  onSuccess?: (result: StartSentryDeveloperConnectionAuthResult) => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to start Sentry authorization" },
    mutationFn: (data: StartSentryDeveloperConnectionAuthInput) =>
      startSentryDeveloperConnectionAuth({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function completeSentryDeveloperConnectionAuthMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to complete Sentry authorization" },
    mutationFn: (data: CompleteSentryDeveloperConnectionAuthInput) =>
      completeSentryDeveloperConnectionAuth({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function setDeveloperConnectionSandboxEnabledMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to update sandbox access" },
    mutationFn: (data: SetDeveloperConnectionSandboxEnabledInput) =>
      setDeveloperConnectionSandboxEnabled({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function disconnectDeveloperConnectionMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to disconnect developer provider" },
    mutationFn: (data: DisconnectDeveloperConnectionInput) =>
      disconnectDeveloperConnection({ data }),
    onSuccess: input?.onSuccess,
  });
}
