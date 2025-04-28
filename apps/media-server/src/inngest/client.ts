import { Inngest, InngestMiddleware } from "@vendor/inngest";

import { Env } from "~/env/wrangler-env";

const bindings = new InngestMiddleware({
  name: "Cloudflare Workers bindings",
  init() {
    return {
      onFunctionRun({ reqArgs }) {
        return {
          transformInput() {
            // reqArgs[1] is the env object from fetch(request, env, ctx)
            const env = reqArgs[1];
            return {
              ctx: {
                env: env as Env,
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
