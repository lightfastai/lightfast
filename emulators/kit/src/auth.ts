import type { Context } from "@emulators/core";

/** Extract the `Bearer <token>` value from the Authorization header, if present. */
export function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }
  return authorization.slice("Bearer ".length);
}
