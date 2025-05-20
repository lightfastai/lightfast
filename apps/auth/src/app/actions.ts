"use server";

import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";

import {
  authSubjects,
  client,
  setTokensNextHandler,
} from "@vendor/openauth/server";

export async function login() {
  const cookies = await getCookies();
  const accessToken = cookies.get("access_token");
  const refreshToken = cookies.get("refresh_token");

  if (accessToken) {
    const verified = await client.verify(authSubjects, accessToken.value, {
      refresh: refreshToken?.value,
    });
    if (!verified.err && verified.tokens) {
      await setTokensNextHandler(
        verified.tokens.access,
        verified.tokens.refresh,
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
}
