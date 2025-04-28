import { Context } from "hono";

import { Inngest, InngestMiddleware } from "@vendor/inngest";

import { Env } from "../../../env/wrangler-env";

const bindings = new InngestMiddleware({
  name: "Hono bindings",
  init({ client, fn }) {
    return {
      onFunctionRun({ ctx, fn, steps, reqArgs }) {
        return {
          transformInput({ ctx, fn, steps }) {
            // reqArgs is the array of arguments passed to a Hono handler
            // We cast the argument to the correct Hono Context type with our
            // environment variable bindings
            const [honoCtx] = reqArgs as [Context<{ Bindings: Env }>];
            return {
              ctx: {
                // Return the context's env object to the function handler's input args
                env: honoCtx.env,
              },
            };
          },
        };
      },
    };
  },
});

export const inngest = new Inngest({
  id: "lightfast-media-server",
  env: "dev",
  middleware: [bindings],
});
