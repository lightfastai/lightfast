import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { client } from "@vendor/openauth/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const redirectUri = url.searchParams.get("redirect_uri");

  if (!redirectUri) {
    return NextResponse.json(
      { error: "Missing redirect_uri parameter" },
      { status: 400 },
    );
  }

  try {
    // Create authorization URL with the provided redirect_uri
    const { url: authUrl } = await client.authorize(redirectUri, "code");

    // Redirect to the authorization URL
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Failed to create authorization URL:", error);
    return NextResponse.json(
      { error: "Failed to create authorization URL" },
      { status: 500 },
    );
  }
}
