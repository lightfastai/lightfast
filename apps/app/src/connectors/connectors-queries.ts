import {
  type ConnectorSectionsResult,
  type ListConnectorsResult,
  listConnectorSections,
  listConnectors,
} from "@api/app/tanstack/connectors";
import { queryOptions } from "@tanstack/react-query";

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
