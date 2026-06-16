import "@tanstack/react-start/server-only";

import { env } from "~/env";

function originFromUrl(value: string | undefined) {
  if (!value) {
    return;
  }
  try {
    return new URL(value).origin;
  } catch {
    return;
  }
}

const canonicalAppOrigin = originFromUrl(env.VITE_LIGHTFAST_APP_URL);
const directAppOrigin = originFromUrl(process.env.PORTLESS_URL);

export function isAllowedWebOrigin(origin: string | null): origin is string {
  if (!origin) {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const originValue = originUrl.origin;
  return (
    originValue === canonicalAppOrigin ||
    (directAppOrigin !== undefined && originValue === directAppOrigin)
  );
}

export function isDesktopDevOrigin(origin: string | null): origin is string {
  if (!origin) {
    return false;
  }
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

export function isPackagedDesktopRequest(
  origin: string | null,
  headers: Headers
): boolean {
  if (headers.get("x-lightfast-desktop") !== "1") {
    return false;
  }
  return origin === "null";
}

export function setCorsHeaders(request: Request, response: Response) {
  const origin = request.headers.get("origin");

  if (
    !(
      isAllowedWebOrigin(origin) ||
      isDesktopDevOrigin(origin) ||
      isPackagedDesktopRequest(origin, request.headers)
    )
  ) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", origin ?? "null");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "content-type,authorization,x-trpc-source,trpc-accept,x-lightfast-desktop,x-lightfast-native-client,x-lightfast-organization-id"
  );
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Credentials", "true");

  return response;
}
