import type { NextResponse } from "next/server";

import { REQUEST_ID_HEADER } from "./constants";

/**
 * Helper to set request ID cookie with consistent settings
 */
export const setRequestIdCookie = (
  response: NextResponse,
  requestId: string,
) => {
  response.cookies.set(REQUEST_ID_HEADER, requestId, {
    path: "/",
    secure: true,
    sameSite: "strict",
    httpOnly: false, // Allow client-side access for our request ID system
  });
};
