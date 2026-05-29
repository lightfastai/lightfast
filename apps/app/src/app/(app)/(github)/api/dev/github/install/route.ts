import { GITHUB_SETUP_PATH } from "@repo/github-app-contract";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const installUrlOverride = process.env.GITHUB_INSTALL_URL_OVERRIDE;

  if (process.env.VERCEL_ENV === "production" || !installUrlOverride) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  let installUrl: URL;
  try {
    installUrl = new URL(installUrlOverride);
  } catch {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const installationId = installUrl.searchParams.get("installation_id");
  if (!installationId) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  if (!state) {
    return Response.json(
      { error: "Invalid GitHub install shim request" },
      { status: 400 }
    );
  }

  const redirectUrl = new URL(GITHUB_SETUP_PATH, installUrl.origin);
  redirectUrl.searchParams.set("installation_id", installationId);
  redirectUrl.searchParams.set("setup_action", "install");
  redirectUrl.searchParams.set("state", state);
  return NextResponse.redirect(redirectUrl);
}
