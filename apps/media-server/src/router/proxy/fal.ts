import { Hono } from "hono";

import * as falProxy from "@repo/ai/fal/hono-server";

import { getEnv } from "~/env/wrangler-env";

// Create a Hono app that uses the Fal proxy
const falProxyApp = new Hono();

// Re-export the GET, POST handlers from the official Fal proxy
falProxyApp.get(`*`, (c) => {
  return falProxy.createRouteHandler({
    resolveApiKey() {
      return Promise.resolve(getEnv(c).FAL_KEY);
    },
  })(c);
});

falProxyApp.post(`*`, (c) => {
  return falProxy.createRouteHandler({
    resolveApiKey() {
      return Promise.resolve(getEnv(c).FAL_KEY);
    },
  })(c);
});

export default falProxyApp;
