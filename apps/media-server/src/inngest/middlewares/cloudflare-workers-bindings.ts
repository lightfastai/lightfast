import { Env } from "hono/types";

import { InngestMiddleware } from "@vendor/inngest";

export const cloudflareWorkerBindings = new InngestMiddleware({
  name: "Cloudflare Workers bindings",
  init({ client, fn }) {
    return {
      onFunctionRun({ ctx, fn, steps, reqArgs }) {
        return {
          transformInput({ ctx, fn, steps }) {
            // reqArgs is the array of arguments passed to the Worker's fetch event handler
            // ex. fetch(request, env, ctx)
            // We cast the argument to the global Env var that Wrangler generates:
            const env = reqArgs[1] as Env;
            return {
              ctx: {
                // Return the env object to the function handler's input args
                env,
              },
            };
          },
        };
      },
    };
  },
});
