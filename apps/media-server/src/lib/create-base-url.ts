import { Context } from "hono";

import { Env, getEnv } from "../env/wrangler-env";

export const createBaseUrl = (c: Context): string => {
  // Use BASE_URL for Cloudflare Workers (set in wrangler.toml)
  const env = getEnv(c);
  if (env.BASE_URL) {
    return env.BASE_URL;
  }
  return `http://localhost:${env.PORT}`;
};

export const createImageSuccessWebhookUrl = (
  c: Context,
  { id }: { id: string },
): string => {
  return `${createBaseUrl(c)}/api/resources/generate/image/success?id=${id}`;
};

export const createImageSuccessWebhookUrlFromEnv = (
  env: Env,
  { id }: { id: string },
): string => {
  const baseUrl = env.BASE_URL
    ? env.BASE_URL
    : `http://localhost:${env.PORT ?? 8787}`;
  return `${baseUrl}/api/resources/generate/image/success?id=${id}`;
};
