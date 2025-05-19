import { createClient } from "@openauthjs/openauth/client";

export const client = createClient({
  clientID: "nextjs", // @TODO what should this be?
  issuer: "http://localhost:3001",
});
