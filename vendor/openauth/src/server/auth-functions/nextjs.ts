"use server";

import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";

import type { UserSession } from "@vendor/openauth";
import { $SessionType } from "@vendor/openauth";

import { openauthEnv } from "../../../env";
import { client } from "../root";
import { authSubjects } from "../subjects";

const getCookieName = (name: string) => {
  return openauthEnv.NODE_ENV === "production" ? `__Secure-${name}` : name;
};

export const auth = async (): Promise<UserSession | null> => {
  const cookies = await getCookies();
  const accessToken = cookies.get(getCookieName("openauth.access-token"));
  const refreshToken = cookies.get(getCookieName("openauth.refresh-token"));

  if (!accessToken) {
    console.log("No access token found");
    return null;
  }

  const verified = await client.verify(authSubjects, accessToken.value, {
    refresh: refreshToken?.value,
  });

  if (verified.err) {
    console.log("Error verifying token", verified.err);
    return null;
  }

  if (verified.tokens) {
    console.log(
      "Setting tokens",
      verified.tokens.access,
      verified.tokens.refresh,
    );
    await setTokens(verified.tokens.access, verified.tokens.refresh);
  }

  return {
    type: $SessionType.Enum.user,
    user: {
      id: verified.subject.properties.id,
      accessToken: accessToken.value,
      refreshToken: refreshToken?.value ?? "",
    },
  };
};

export const setTokens = async (access: string, refresh: string) => {
  const cookies = await getCookies();
  cookies.set({
    name: getCookieName("openauth.access-token"),
    value: access,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
    secure: openauthEnv.NODE_ENV === "production" ? true : false,
  });
  cookies.set({
    name: getCookieName("openauth.refresh-token"),
    value: refresh,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
    secure: openauthEnv.NODE_ENV === "production" ? true : false,
  });
};

export const logout = async () => {
  const cookies = await getCookies();
  cookies.delete(getCookieName("openauth.access-token"));
  cookies.delete(getCookieName("openauth.refresh-token"));
  redirect("/");
};

export const login = async () => {
  const cookies = await getCookies();
  const accessToken = cookies.get(getCookieName("openauth.access-token"));
  const refreshToken = cookies.get(getCookieName("openauth.refresh-token"));

  if (accessToken) {
    const verified = await client.verify(authSubjects, accessToken.value, {
      refresh: refreshToken?.value,
    });
    if (!verified.err && verified.tokens) {
      await setTokens(verified.tokens.access, verified.tokens.refresh);
      redirect("/");
    }
  }

  const headers = await getHeaders();
  const host = headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const { url } = await client.authorize(
    `${protocol}://${host}/api/callback`,
    "code",
  );
  redirect(url);
};

export const authFromRequest = async (
  req: Request,
): Promise<UserSession | null> => {
  const headers = new Headers(req.headers);

  // Check source to determine where to get tokens from
  const source = headers.get("x-trpc-source");

  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  if (source === "electron-react") {
    // For Electron, tokens are in custom headers
    accessToken = headers.get("x-access-token");
    refreshToken = headers.get("x-refresh-token");
    console.log("Using electron auth headers");
  } else {
    // For Next.js, tokens are in cookies
    const cookieHeader = headers.get("cookie");

    if (!cookieHeader) {
      console.log("No cookies found");
      return null;
    }

    // Parse cookies from the cookie header
    const cookies = parseCookies(cookieHeader);

    accessToken = cookies[getCookieName("openauth.access-token")] ?? null;
    refreshToken = cookies[getCookieName("openauth.refresh-token")] ?? null;
  }

  if (!accessToken) {
    console.log("No access token found");
    return null;
  }

  const verified = await client.verify(authSubjects, accessToken, {
    refresh: refreshToken ?? undefined,
  });

  if (verified.err) {
    console.log("Error verifying token", verified.err);
    return null;
  }

  if (verified.tokens) {
    console.log(
      "Setting tokens",
      verified.tokens.access,
      verified.tokens.refresh,
    );
    await setTokens(verified.tokens.access, verified.tokens.refresh);
  }

  return {
    type: $SessionType.Enum.user,
    user: {
      id: verified.subject.properties.id,
      accessToken: accessToken,
      refreshToken: refreshToken ?? "",
    },
  };
};

// Helper function to parse cookies from header
function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("="))
    .reduce(
      (cookies, [key, value]) => {
        cookies[key] = decodeURIComponent(value);
        return cookies;
      },
      {} as Record<string, string>,
    );
}
