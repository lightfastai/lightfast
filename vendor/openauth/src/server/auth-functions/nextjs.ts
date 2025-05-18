"use server";

import { cookies as getCookies } from "next/headers";

import type { UserSession } from "@vendor/openauth";
import { $SessionType } from "@vendor/openauth";

import { client } from "../root";
import { authSubjects } from "../subjects";

export const getUserSession = async (): Promise<UserSession | null> => {
  const cookies = await getCookies();
  const accessToken = cookies.get("access_token");
  const refreshToken = cookies.get("refresh_token");

  if (!accessToken) {
    return null;
  }

  const verified = await client.verify(authSubjects, accessToken.value, {
    refresh: refreshToken?.value,
  });

  if (verified.err) {
    return null;
  }

  if (!verified.tokens) {
    return null;
  }

  return {
    type: $SessionType.Enum.user,
    user: {
      email: verified.subject.properties.email,
      accessToken: verified.tokens.access,
      refreshToken: verified.tokens.refresh,
    },
  } as UserSession;
};
