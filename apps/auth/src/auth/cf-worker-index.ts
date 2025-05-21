import type { ExecutionContext, KVNamespace } from "@cloudflare/workers-types";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";

import { createAuthIssuer } from "./lib/issuer";

interface Env {
  CloudflareAuthKV: KVNamespace; // KV binding
  RESEND_API_KEY: string; // Secret linked by SST
  POSTGRES_URL: string; // Secret linked by SST
  NODE_ENV: string; // Environment variable set by SST
  LIGHTFAST_AUTH_URL: string; // Environment variable set by SST
}

export default {
  async fetch(request: Request, workerEnv: Env, ctx: ExecutionContext) {
    // You can access NODE_ENV like this:
    console.log(`Running in environment: ${workerEnv.NODE_ENV}`);

    // Example: Conditional logic based on environment
    if (workerEnv.NODE_ENV === "staging") {
      console.log(
        "This is the staging environment. Special staging logic can go here.",
      );
    } else if (workerEnv.NODE_ENV === "production") {
      console.log("This is the production environment.");
    }

    // Secrets are passed to createAuthIssuer
    const issuerInstance = createAuthIssuer({
      env: {
        RESEND_API_KEY: workerEnv.RESEND_API_KEY,
        POSTGRES_URL: workerEnv.POSTGRES_URL,
        LIGHTFAST_AUTH_URL: workerEnv.LIGHTFAST_AUTH_URL,
      },
      storage: CloudflareStorage({
        namespace: workerEnv.CloudflareAuthKV,
      }),
    });

    return issuerInstance.fetch(request, workerEnv, ctx);
  },
};
