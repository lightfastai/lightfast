import { Context } from "hono";

import { getEnv } from "../env/wrangler-env";

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
