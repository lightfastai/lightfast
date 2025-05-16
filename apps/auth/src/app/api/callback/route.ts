import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { client, setTokens } from "../../auth";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirectUri = url.searchParams.get("redirect_uri");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  // If redirectUri is provided and is a custom protocol (Electron app),
  // use that instead of the default
  const callbackUrl = redirectUri ?? `${url.origin}/api/callback`;

  const exchanged = await client.exchange(code, callbackUrl);

  if (exchanged.err) {
    return NextResponse.json(exchanged.err, { status: 400 });
  }

  // For web flows, set cookies
  if (!redirectUri?.startsWith("lightfast://")) {
    await setTokens(exchanged.tokens.access, exchanged.tokens.refresh);
    return NextResponse.redirect(`${url.origin}/`);
  }

  // For Electron app, redirect with tokens as URL parameters
  const electronRedirectUrl = new URL(redirectUri);
  electronRedirectUrl.searchParams.set("access_token", exchanged.tokens.access);
  electronRedirectUrl.searchParams.set(
    "refresh_token",
    exchanged.tokens.refresh,
  );

  return NextResponse.redirect(electronRedirectUrl.toString());
}
