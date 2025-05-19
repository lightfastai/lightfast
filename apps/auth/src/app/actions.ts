"use server";

import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { authSubjects, client, setTokens } from "@vendor/openauth/server";

// export async function auth() {
//   const cookies = await getCookies();
//   const accessToken = cookies.get("access_token");
//   const refreshToken = cookies.get("refresh_token");

//   if (!accessToken) {
//     return false;
//   }

//   const verified = await client.verify(authSubjects, accessToken.value, {
//     refresh: refreshToken?.value,
//   });

//   if (verified.err) {
//     return false;
//   }
//   if (verified.tokens) {
//     await setTokens(verified.tokens.access, verified.tokens.refresh);
//   }

//   return verified.subject;
// }

export async function login() {
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
}

export async function logout() {
  const cookies = await getCookies();
  cookies.delete("access_token");
  cookies.delete("refresh_token");

  redirect("/");
}
