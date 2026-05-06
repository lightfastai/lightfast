import { verifyToken } from "@clerk/nextjs/server";

import { env } from "~/env";

export async function verifyCliJwt(
  req: Request
): Promise<{ userId: string; jwt: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const jwt = authHeader.replace("Bearer ", "");
  try {
    const payload = await verifyToken(jwt, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    return { userId: payload.sub, jwt };
  } catch {
    return null;
  }
}
