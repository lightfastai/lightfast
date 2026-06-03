import type {
  ProviderRoutineClassification,
  ProviderToolName,
} from "@repo/provider-routine-contract";

const LINEAR_READ_ROUTINES = new Set([
  "get_issue",
  "get_project",
  "get_user",
  "list_comments",
  "list_cycles",
  "list_issues",
  "list_projects",
  "list_teams",
  "search_issues",
  "viewer",
]);

const LINEAR_WRITE_ROUTINES = new Set([
  "archive_issue",
  "assign_issue",
  "create_comment",
  "create_issue",
  "create_project",
  "delete_comment",
  "delete_issue",
  "move_issue",
  "update_comment",
  "update_issue",
  "update_project",
]);

function providerToolNameIs(pattern: string, providerToolName: string) {
  return new RegExp(`^${pattern}(_|[A-Z]|$)`).test(providerToolName);
}

export function classifyXRoutine(
  providerToolName: string
): ProviderRoutineClassification {
  if (providerToolNameIs("get|list|search|viewer", providerToolName)) {
    return "read";
  }
  if (
    providerToolNameIs(
      "archive|assign|create|delete|move|remove|set|update|post",
      providerToolName
    )
  ) {
    return "write";
  }
  return "read";
}

export function hasRoutineScope(input: {
  classification: ProviderRoutineClassification;
  scopes: { providerRoutineRead: boolean; providerRoutineWrite: boolean };
}) {
  if (input.classification === "read") {
    return (
      input.scopes.providerRoutineRead || input.scopes.providerRoutineWrite
    );
  }
  return input.scopes.providerRoutineWrite;
}

export function classifyLinearRoutine(
  providerToolName: string
): ProviderRoutineClassification {
  if (LINEAR_READ_ROUTINES.has(providerToolName)) {
    return "read";
  }
  if (LINEAR_WRITE_ROUTINES.has(providerToolName)) {
    return "write";
  }
  if (/^(get|list|search|viewer)(_|$)/.test(providerToolName)) {
    return "read";
  }
  if (
    /^(archive|assign|create|delete|move|remove|set|update)(_|$)/.test(
      providerToolName
    )
  ) {
    return "write";
  }
  return "unknown_write_default";
}

export function classifyRoutine(input: {
  provider: import("@repo/connector-contract").ConnectableConnectorProvider;
  providerToolName: ProviderToolName | string;
}): ProviderRoutineClassification {
  switch (input.provider) {
    case "linear":
      return classifyLinearRoutine(input.providerToolName);
    case "x":
      return classifyXRoutine(input.providerToolName);
    default:
      return "unknown_write_default";
  }
}
