import { getCloudflareContext } from "@opennextjs/cloudflare/cloudflare-context";

export const createBaseUrl = (): string => {
  // Use BASE_URL for Cloudflare Workers (set in wrangler.toml)
  if (getCloudflareContext().env.BASE_URL) {
    return getCloudflareContext().env.BASE_URL;
  }
  return `http://localhost:${getCloudflareContext().env.PORT}`;
};

export const createImageSuccessWebhookUrl = ({
  id,
}: {
  id: string;
}): string => {
  return `${createBaseUrl()}/api/resources/generate/image/success?id=${id}`;
};

export const createVideoSuccessWebhookUrl = ({
  id,
}: {
  id: string;
}): string => {
  return `${createBaseUrl()}/api/resources/generate/video/success?id=${id}`;
};
