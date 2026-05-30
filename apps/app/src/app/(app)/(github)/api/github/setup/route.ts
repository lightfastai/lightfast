import { completeGitHubInstallationSetup } from "@api/app/services/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeGitHubInstallationSetup({
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
