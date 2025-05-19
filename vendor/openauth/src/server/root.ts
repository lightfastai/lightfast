import { createClient } from "@openauthjs/openauth/client";

import { openauthEnv } from "../../env";

export const client = createClient({
  clientID: "nextjs", // @TODO what should this be?
  issuer: openauthEnv.NEXT_PUBLIC_OPENAUTH_ISSUER_URL,
});
