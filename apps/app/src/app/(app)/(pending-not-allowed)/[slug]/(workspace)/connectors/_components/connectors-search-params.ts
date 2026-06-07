import { parseAsStringLiteral } from "nuqs";

export type ConnectorOwnerScope = "team" | "personal";

export const connectorOwnerScopeParser = parseAsStringLiteral([
  "team",
  "personal",
]).withDefault("team");
