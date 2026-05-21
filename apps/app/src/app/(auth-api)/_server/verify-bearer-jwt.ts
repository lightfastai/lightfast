import { verifyToken } from "@clerk/nextjs/server";
import { z } from "zod";

import { env } from "~/env";

const ClerkJwtClaims = z.object({
  org_id: z.string().nullish(),
  sub: z.string(),
});

export async function verifyBearerJwt(
  req: Request
): Promise<{ jwt: string; orgId: null | string; userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const jwt = authHeader.replace("Bearer ", "");
  try {
    const payload = ClerkJwtClaims.parse(
      await verifyToken(jwt, {
        secretKey: env.CLERK_SECRET_KEY,
      })
    );
    return { userId: payload.sub, jwt, orgId: payload.org_id ?? null };
  } catch {
    return null;
  }
}
