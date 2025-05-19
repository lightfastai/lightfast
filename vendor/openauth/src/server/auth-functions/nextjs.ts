"use server";

import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";

import type { UserSession } from "@vendor/openauth";
import { $SessionType } from "@vendor/openauth";

import { client } from "../root";
import { authSubjects } from "../subjects";

export const auth = async (): Promise<UserSession | null> => {
  const cookies = await getCookies();
  const accessToken = cookies.get("access_token");
  const refreshToken = cookies.get("refresh_token");

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
    name: "access_token",
    value: access,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
  });
  cookies.set({
    name: "refresh_token",
    value: refresh,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 34560000,
  });
};

export const logout = async () => {
  const cookies = await getCookies();
  cookies.delete("access_token");
  cookies.delete("refresh_token");
  redirect("/");
};

export const login = async () => {
  const cookies = await getCookies();
  const accessToken = cookies.get("access_token");
  const refreshToken = cookies.get("refresh_token");

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
