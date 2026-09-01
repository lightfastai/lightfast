export interface LightfastMcpEnv {
  LIGHTFAST_API_KEY?: string;
  LIGHTFAST_API_URL?: string;
  [key: string]: string | undefined;
}

export interface LightfastMcpConfig {
  apiKey: string;
  baseUrl: string;
}

export function getLightfastMcpConfig(
  env: LightfastMcpEnv = process.env
): LightfastMcpConfig {
  const apiKey = env.LIGHTFAST_API_KEY;
  if (!apiKey) {
    throw new Error("LIGHTFAST_API_KEY environment variable is required");
  }

  const baseUrl = env.LIGHTFAST_API_URL;
  if (!baseUrl) {
    throw new Error("LIGHTFAST_API_URL environment variable is required");
  }

  return { apiKey, baseUrl };
}
