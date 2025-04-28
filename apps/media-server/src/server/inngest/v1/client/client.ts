import { EventSchemas, Inngest } from "@vendor/inngest";

// import { cloudflareWorkerBindings } from "../middlewares/cloudflare-workers-bindings";
import { Events } from "./types";

// @note because we dont have access to env variables in hono/cloudflare workers, we need to use a static id
// @note the env key & signing key are set in the wrangler.toml file and implicity injected into Inngest Client
export const inngest = new Inngest({
  id: "lightfast-media-server",
  // middleware: [cloudflareWorkerBindings],
  schemas: new EventSchemas().fromRecord<Events>(),
});
