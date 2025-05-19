"use server";

import { cookies as getCookies } from "next/headers";

import type { UserSession } from "@vendor/openauth";
import { $SessionType } from "@vendor/openauth";

import { client } from "../root";
import { authSubjects } from "../subjects";

export const auth = async (): Promise<UserSession | null> => {
  const cookies = await getCookies();
  const accessToken = cookies.get("access_token");
  const refreshToken = cookies.get("refresh_token");

  console.log("accessToken", accessToken);
  console.log("refreshToken", refreshToken);

  if (!accessToken) {
    console.error("No access token found");
    return null;
  }

  const verified = await client.verify(authSubjects, accessToken.value, {
    refresh: refreshToken?.value,
  });

  if (verified.err) {
    console.error("Error verifying token", verified.err);
    return null;
  }

  if (verified.tokens) {
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
