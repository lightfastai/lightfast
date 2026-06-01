export const X_EMULATOR_FIXTURES = {
  oauthClientId: "x_lightfast_local",
  oauthClientSecret: "x-local-secret",
  userId: "x_user_lightfast_local",
  userName: "Lightfast Local",
  username: "lightfast_dev",
  accessToken: "x_access_valid",
  refreshToken: "x_refresh_valid",
} as const;

export const X_EMULATOR_OAUTH_CODE = "x_oauth_code_lightfast_local";

export const X_EMULATOR_SCOPE = "tweet.read users.read offline.access";

export function getXEmulatorEnv(
  _appOrigin: string,
  emulatorOrigin = "http://127.0.0.1:4569"
) {
  return {
    X_CLIENT_ID: X_EMULATOR_FIXTURES.oauthClientId,
    X_CLIENT_SECRET: X_EMULATOR_FIXTURES.oauthClientSecret,
    X_API_ORIGIN: emulatorOrigin,
    X_OAUTH_ORIGIN: emulatorOrigin,
  };
}

const ENV_ASSIGNMENT_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatXEmulatorEnvString(env: Record<string, string>) {
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
