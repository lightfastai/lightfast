import { completeGitHubOAuthVerification } from "@api/app/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeGitHubOAuthVerification({
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
