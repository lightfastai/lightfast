import { Inngest, InngestMiddleware } from "@vendor/inngest";

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
                env,
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
  middleware: [bindings],
});
