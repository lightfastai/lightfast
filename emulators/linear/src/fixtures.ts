export const LINEAR_EMULATOR_FIXTURES = {
  oauthClientId: "linear_emulator_local",
  oauthClientSecret: "linear-local-secret",
  workspaceId: "linear_workspace_emulated",
  workspaceName: "emulator-workspace",
  actorId: "linear_actor_emulator_local",
  actorName: "Linear Emulator",
  accessToken: "linear_access_valid",
  refreshToken: "linear_refresh_valid",
} as const;

export const LINEAR_EMULATOR_OAUTH_CODE = "linear_oauth_code_emulator_local";

export const LINEAR_EMULATOR_TOOLS = [
  "list_issues",
  "get_issue",
  "create_issue",
  "update_issue",
  "list_comments",
  "create_comment",
  "list_projects",
  "get_project",
  "list_teams",
  "get_team",
].map((name) => ({
  name,
  description: `Emulated Linear ${name}`,
  inputSchema: { type: "object", additionalProperties: true },
}));
