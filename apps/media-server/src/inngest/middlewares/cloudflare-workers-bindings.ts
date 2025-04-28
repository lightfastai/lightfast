import { InngestMiddleware } from "@vendor/inngest";

export const bindings = new InngestMiddleware({
  name: "cloudflare-workers-bindings",
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
