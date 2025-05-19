"use server";

import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";

import type { Token, UserSession } from "@vendor/openauth";
import { $SessionType } from "@vendor/openauth";

import { openauthEnv } from "../../../env";
import { getCookieName } from "../cookies";
import { client } from "../root";
import { verifyToken } from "./core";

const ACCESS_TOKEN_COOKIE_NAME = getCookieName("lightfast.access-token");
const REFRESH_TOKEN_COOKIE_NAME = getCookieName("lightfast.refresh-token");

export const getSessionFromCookiesNextHandler =
  async (): Promise<UserSession | null> => {
    const cookies = await getCookies();
    const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME);
    const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE_NAME);

    if (!accessToken) {
      console.log("No access token found");
      return null;
    }

    const verified = await verifyToken(accessToken.value, refreshToken?.value);

    if (verified.err) {
      console.log("Error verifying token", verified.err);
      return null;
    }

    if (verified.tokens) {
      await setTokensNextHandler(
        verified.tokens.access,
        verified.tokens.refresh,
        verified.tokens.expiresIn,
      );
    }

    return {
      type: $SessionType.Enum.user,
      user: {
        id: verified.subject.properties.id,
        accessToken: accessToken.value,
        refreshToken: refreshToken?.value ?? "",
        expiresIn: verified.tokens?.expiresIn,
      },
    };
  };

export const setTokensNextHandler = async (
  access: string,
  refresh: string,
  expiresIn: number,
) => {
  console.log("Setting tokens", access, refresh, expiresIn);
  const cookies = await getCookies();
  cookies.set({
    name: ACCESS_TOKEN_COOKIE_NAME,
    value: access,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
    secure: openauthEnv.NODE_ENV === "production" ? true : false,
  });
  cookies.set({
    name: REFRESH_TOKEN_COOKIE_NAME,
    value: refresh,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
    secure: openauthEnv.NODE_ENV === "production" ? true : false,
  });
};

export const getTokenFromCookiesNextHandler = async (): Promise<Token> => {
  const cookies = await getCookies();
  const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME);
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE_NAME);
  return {
    accessToken: accessToken?.value ?? "",
    refreshToken: refreshToken?.value ?? "",
  };
};

export const logout = async () => {
  const cookies = await getCookies();
  cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
  cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
  redirect("/");
};

export const login = async () => {
  const cookies = await getCookies();
  const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME);
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE_NAME);

  if (accessToken) {
    const verified = await verifyToken(accessToken.value, refreshToken?.value);
    if (!verified.err && verified.tokens) {
      await setTokensNextHandler(
        verified.tokens.access,

        verified.tokens.refresh,
        verified.tokens.expiresIn,
      );
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

export const getSessionFromExternalRequest = async (
  headers: Headers,
): Promise<UserSession | null> => {
  // For desktop app, tokens are in custom headers
  const accessToken = headers.get("x-lightfast-trpc-access-token");
  const refreshToken = headers.get("x-lightfast-trpc-refresh-token");

  console.log(
    "Using lightfast-desktop auth headers",
    accessToken,
    refreshToken,
  );

  if (!accessToken) {
    console.log("No access token found");
    return null;
  }

  const verified = await verifyToken(accessToken, refreshToken ?? undefined);

  if (verified.err) {
    console.log("Error verifying token", verified.err);
    return null;
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
