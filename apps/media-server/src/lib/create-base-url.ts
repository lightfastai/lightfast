import { env } from "../env.js";

export const createBaseUrl = () => {
  // @todo: this is a hack to get the base url for render
  if (env.RENDER) {
    return `https://${env.RENDER_SERVICE_NAME}.onrender.com`;
  }

  if (env.BASE_URL) {
    return env.BASE_URL;
  }

  return `http://localhost:${env.PORT}`;
};

export const createImageSuccessWebhookUrl = () => {
  return `${createBaseUrl()}/api/resources/generate/image/success`;
};
