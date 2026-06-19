import type {
  ConnectorSectionsResult,
  ListConnectorsResult,
} from "@api/app/tanstack/connectors";

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
