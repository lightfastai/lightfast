import { Hono } from "hono";

import * as falProxy from "@repo/ai/fal/hono-server";

import { env } from "../../env.js";

// Create a Hono app that uses the Fal proxy
const falProxyApp = new Hono();

// Re-export the GET, POST handlers from the official Fal proxy
falProxyApp.get(
  `*`,
  falProxy.createRouteHandler({
    resolveApiKey() {
      return Promise.resolve(env.FAL_KEY);
    },
  }),
);
falProxyApp.post(
  `*`,
  falProxy.createRouteHandler({
    resolveApiKey() {
      return Promise.resolve(env.FAL_KEY);
    },
  }),
);

export default falProxyApp;
