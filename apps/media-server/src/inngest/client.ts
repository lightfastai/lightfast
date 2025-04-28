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

const inngestEnv =
  typeof globalThis !== "undefined" && (globalThis as any).env?.INNGEST_ENV
    ? (globalThis as any).env.INNGEST_ENV
    : undefined;

export const inngest = new Inngest({
  id: "lightfast-media-server",
  env: inngestEnv,
  middleware: [bindings],
});
