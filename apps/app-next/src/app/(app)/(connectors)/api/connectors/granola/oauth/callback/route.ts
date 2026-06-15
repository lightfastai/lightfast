import { completeGranolaUserConnectorOAuth } from "@api/app/services/user-connectors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function accountSettingsRedirect(requestUrl: string, error: string) {
  const url = new URL("/account/settings", requestUrl);
  url.searchParams.set("connector", "granola");
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return accountSettingsRedirect(request.url, error);
  }

  if (!(code && state)) {
    return accountSettingsRedirect(request.url, "missing_oauth_code");
  }

  const result = await completeGranolaUserConnectorOAuth({
    code,
    requestUrl: request.url,
    state,
  });
  return NextResponse.redirect(result.redirectUrl);
}
