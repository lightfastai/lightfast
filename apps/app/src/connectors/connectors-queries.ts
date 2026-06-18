import {
  type ConnectorSectionsResult,
  type DisconnectConnectorInput,
  disconnectConnector,
  type ListConnectorsResult,
  listConnectorSections,
  listConnectors,
  type RefreshConnectorToolsInput,
  refreshConnectorTools,
  type SetConnectorAgentEnabledInput,
  type SetConnectorAutomationEnabledInput,
  type StartConnectorInput,
  type StartConnectorResult,
  setConnectorAgentEnabled,
  setConnectorAutomationEnabled,
  startConnector,
} from "@api/app/tanstack/connectors";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

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
    mutationFn: (data: StartConnectorInput) => startConnector({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function refreshConnectorToolsMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to refresh connector tools" },
    mutationFn: (data: RefreshConnectorToolsInput) =>
      refreshConnectorTools({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function setConnectorAutomationEnabledMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to update connector automation access" },
    mutationFn: (data: SetConnectorAutomationEnabledInput) =>
      setConnectorAutomationEnabled({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function setConnectorAgentEnabledMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to update connector agent access" },
    mutationFn: (data: SetConnectorAgentEnabledInput) =>
      setConnectorAgentEnabled({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function disconnectConnectorMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    meta: { errorTitle: "Failed to disconnect provider" },
    mutationFn: (data: DisconnectConnectorInput) =>
      disconnectConnector({ data }),
    onSuccess: input?.onSuccess,
  });
}
