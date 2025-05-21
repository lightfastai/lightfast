import { MemoryStorage } from "@openauthjs/openauth/storage/memory";

import { env as devEnv } from "../env";
import { createAuthIssuer } from "./lib/issuer";

export default createAuthIssuer({
  env: {
    RESEND_API_KEY: devEnv.RESEND_API_KEY,
    POSTGRES_URL: devEnv.POSTGRES_URL,
    LIGHTFAST_AUTH_URL: devEnv.LIGHTFAST_AUTH_URL,
  },
  storage: MemoryStorage(),
});
