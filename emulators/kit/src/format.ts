const ENV_ASSIGNMENT_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatEnvString(env: Record<string, string>): string {
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
