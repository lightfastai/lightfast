import {
  completeSentryDeveloperConnectionAuth,
  connectDeveloperConnection,
  disconnectDeveloperConnection,
  listDeveloperConnections,
  setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth,
} from "@api/app/tanstack/developer-connections";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

type ServerFunctionData<TFn> = TFn extends (args: {
  data: infer TData;
}) => unknown
  ? TData
  : never;
type DeveloperConnectionConnectInput = ServerFunctionData<
  typeof connectDeveloperConnection
>;
type DeveloperConnectionStartAuthInput = ServerFunctionData<
  typeof startSentryDeveloperConnectionAuth
>;
type DeveloperConnectionCompleteAuthInput = ServerFunctionData<
  typeof completeSentryDeveloperConnectionAuth
>;
type DeveloperConnectionSetSandboxEnabledInput = ServerFunctionData<
  typeof setDeveloperConnectionSandboxEnabled
>;
type DeveloperConnectionProviderInput = ServerFunctionData<
  typeof disconnectDeveloperConnection
>;
type StartSentryDeveloperConnectionAuthResult = Awaited<
  ReturnType<typeof startSentryDeveloperConnectionAuth>
>;

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
    mutationFn: (data: DeveloperConnectionConnectInput) =>
      connectDeveloperConnection({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function startSentryDeveloperConnectionAuthMutationOptions(input?: {
  onSuccess?: (result: StartSentryDeveloperConnectionAuthResult) => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to start Sentry authorization" },
    mutationFn: (data: DeveloperConnectionStartAuthInput) =>
      startSentryDeveloperConnectionAuth({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function completeSentryDeveloperConnectionAuthMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to complete Sentry authorization" },
    mutationFn: (data: DeveloperConnectionCompleteAuthInput) =>
      completeSentryDeveloperConnectionAuth({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function setDeveloperConnectionSandboxEnabledMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to update sandbox access" },
    mutationFn: (data: DeveloperConnectionSetSandboxEnabledInput) =>
      setDeveloperConnectionSandboxEnabled({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function disconnectDeveloperConnectionMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to disconnect developer provider" },
    mutationFn: (data: DeveloperConnectionProviderInput) =>
      disconnectDeveloperConnection({ data }),
    onSuccess: input?.onSuccess,
  });
}
