import { createClient } from "@openauthjs/openauth/client";

import { openauthEnv } from "../../env";

export const client = createClient({
  clientID: "nextjs", // @TODO what should this be?
  issuer: openauthEnv.OPENAUTH_ISSUER_URL,
});
