export const LINEAR_EMULATOR_FIXTURES = {
  oauthClientId: "linear_lightfast_local",
  oauthClientSecret: "linear-local-secret",
  workspaceId: "linear_workspace_lightfast_emulated",
  workspaceName: "lightfast-emulated",
  actorId: "linear_actor_lightfast_local",
  actorName: "Lightfast Local",
  accessToken: "linear_access_valid",
  refreshToken: "linear_refresh_valid",
} as const;

export const LINEAR_EMULATOR_OAUTH_CODE =
  "linear_oauth_code_lightfast_local";

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

export function getLinearEmulatorEnv(
  _appOrigin: string,
  emulatorOrigin = "http://127.0.0.1:4568"
) {
  return {
    LINEAR_CLIENT_ID: LINEAR_EMULATOR_FIXTURES.oauthClientId,
    LINEAR_CLIENT_SECRET: LINEAR_EMULATOR_FIXTURES.oauthClientSecret,
    LINEAR_API_ORIGIN: emulatorOrigin,
    LINEAR_MCP_ENDPOINT: `${emulatorOrigin}/mcp`,
  };
}

const ENV_ASSIGNMENT_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatLinearEmulatorEnvString(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => {
      if (!ENV_ASSIGNMENT_NAME_RE.test(key)) {
        throw new Error(`Invalid environment variable name: ${key}`);
      }
      if (value.includes("\0")) {
        throw new Error(
          `Environment variable ${key} contains a NUL byte and cannot be passed to env -S`
        );
      }
      return `${key}=${shellQuote(value)}`;
    })
    .join("\n");
}
