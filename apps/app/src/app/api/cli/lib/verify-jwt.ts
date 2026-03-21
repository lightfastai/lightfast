import { verifyToken } from "@clerk/nextjs/server";

import { env } from "~/env";

export async function verifyCliJwt(
  req: Request
): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
