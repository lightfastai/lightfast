import { completeGitHubInstallationSetup } from "@api/app/github";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getAppOrigin(req: Request) {
  const installUrlOverride = process.env.GITHUB_INSTALL_URL_OVERRIDE;
  if (installUrlOverride) {
    return new URL(installUrlOverride).origin;
  }
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? req.url).origin;
}

export async function GET(req: Request) {
  const result = await completeGitHubInstallationSetup({
    appOrigin: getAppOrigin(req),
    requestUrl: req.url,
  });
  return NextResponse.redirect(result.redirectUrl);
}
