import { completeGitHubInstallationSetup } from "@api/app/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await completeGitHubInstallationSetup({
    appOrigin: new URL(req.url).origin,
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
