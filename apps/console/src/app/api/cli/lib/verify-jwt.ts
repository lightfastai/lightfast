import { verifyToken } from "@clerk/nextjs/server";

export async function verifyCliJwt(
  req: Request
): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? "",
    });
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
