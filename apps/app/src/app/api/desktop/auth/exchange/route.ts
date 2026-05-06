// POST /api/desktop/auth/exchange
// Auth: none — the code itself proves possession of the in-flight sign-in.
// Verifier check (PKCE S256) binds the exchange to the same client that
// issued the code via /api/desktop/auth/code.
import { createHash } from "node:crypto";
import { z } from "zod";
import { consumeCode } from "../lib/code-store";

const bodySchema = z.object({
  code: z.string().min(32).max(128),
  code_verifier: z.string().min(43).max(128),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const record = await consumeCode(parsed.data.code);
  if (!record) {
    return Response.json({ error: "invalid_code" }, { status: 400 });
  }

  const expected = createHash("sha256")
    .update(parsed.data.code_verifier)
    .digest("base64url");
  if (expected !== record.codeChallenge) {
    return Response.json({ error: "invalid_verifier" }, { status: 400 });
  }
  return Response.json({ token: record.jwt });
}
