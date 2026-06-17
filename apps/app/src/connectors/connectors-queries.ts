import {
  type ConnectorSectionsResult,
  disconnectConnector,
  type ListConnectorsResult,
  listConnectorSections,
  listConnectors,
  refreshConnectorTools,
  setConnectorAgentEnabled,
  setConnectorAutomationEnabled,
  startConnector,
} from "@api/app/tanstack/connectors";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

type ServerFunctionData<TFn> = TFn extends (args: {
  data: infer TData;
}) => unknown
  ? TData
  : never;

type ConnectorProviderInput = ServerFunctionData<typeof disconnectConnector>;
type ConnectorStartInput = ServerFunctionData<typeof startConnector>;
type ConnectorSetAutomationEnabledInput = ServerFunctionData<
  typeof setConnectorAutomationEnabled
>;
type ConnectorSetAgentEnabledInput = ServerFunctionData<
  typeof setConnectorAgentEnabled
>;
type StartConnectorResult = Awaited<ReturnType<typeof startConnector>>;

export type ConnectorSections = ConnectorSectionsResult;
export type TeamConnectorCatalogRow =
  ConnectorSections["teamConnectors"][number];
export type UserConnectorCatalogRow =
  ConnectorSections["yourConnectors"][number];
export type ConnectorCatalogRow =
  | TeamConnectorCatalogRow
  | UserConnectorCatalogRow;
export type ConnectorsList = ListConnectorsResult;

export const connectorQueryKeys = {
  all: ["connectors"] as const,
  list: () => ["connectors", "list"] as const,
  sections: () => ["connectors", "sections"] as const,
};

export function connectorsListQueryOptions(input?: { staleTime?: number }) {
  return queryOptions({
    queryFn: () => listConnectors(),
    queryKey: connectorQueryKeys.list(),
    staleTime: input?.staleTime,
  });
}

export function connectorSectionsQueryOptions(input?: { staleTime?: number }) {
  return queryOptions({
    queryFn: () => listConnectorSections(),
    queryKey: connectorQueryKeys.sections(),
    staleTime: input?.staleTime,
  });
}

export function startConnectorMutationOptions(input?: {
  onSuccess?: (result: StartConnectorResult) => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to connect provider" },
    mutationFn: (data: ConnectorStartInput) => startConnector({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function refreshConnectorToolsMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to refresh connector tools" },
    mutationFn: (data: ConnectorProviderInput) =>
      refreshConnectorTools({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function setConnectorAutomationEnabledMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to update connector automation access" },
    mutationFn: (data: ConnectorSetAutomationEnabledInput) =>
      setConnectorAutomationEnabled({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function setConnectorAgentEnabledMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to update connector agent access" },
    mutationFn: (data: ConnectorSetAgentEnabledInput) =>
      setConnectorAgentEnabled({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function disconnectConnectorMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to disconnect provider" },
    mutationFn: (data: ConnectorProviderInput) => disconnectConnector({ data }),
    onSuccess: input?.onSuccess,
  });
}
