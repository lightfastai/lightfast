import { Env } from "../env/wrangler-env";

export const createBaseUrl = (env: Env): string => {
  // Use BASE_URL for Cloudflare Workers (set in wrangler.toml)
  if (env.BASE_URL) {
    return env.BASE_URL;
  }
  return `http://localhost:${env.PORT}`;
};

export const createImageSuccessWebhookUrl = (
  env: Env,
  { id }: { id: string },
): string => {
  const baseUrl = createBaseUrl(env);
  return `${baseUrl}/api/resources/generate/image/success?id=${id}`;
};
