// POST /api/desktop/auth/code
// Auth: Clerk JWT (lightfast-desktop template) in Authorization header.
import { z } from "zod";
import { verifyCliJwt } from "../../../cli/lib/verify-jwt";
import { issueCode } from "../lib/code-store";

const ALLOWED_REDIRECT_URIS = new Set([
  "lightfast://auth/callback",
  "lightfast-dev://auth/callback",
]);

const bodySchema = z.object({
  state: z.string().min(16).max(256),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().refine((u) => ALLOWED_REDIRECT_URIS.has(u)),
});

export async function POST(req: Request) {
  const session = await verifyCliJwt(req);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");

  const code = await issueCode({
    userId: session.userId,
    jwt,
    state: parsed.data.state,
    codeChallenge: parsed.data.code_challenge,
    redirectUri: parsed.data.redirect_uri,
  });
  return Response.json({ code });
}
