import {
  type NativeClient,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";

import { createNativeAuthCaller } from "~/app/api/native-auth/_server/native-auth-caller";

import { NativeAuthOrgSelect } from "./_components/native-auth-org-select";

function isLoopbackRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    const port = Number.parseInt(url.port, 10);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.pathname === "/callback" &&
      Number.isInteger(port) &&
      port > 0
    );
  } catch {
    return false;
  }
}

const nativeAuthStartSearchSchema = z.object({
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().url().refine(isLoopbackRedirectUri),
  state: z.string().min(16).max(256),
});

export default async function NativeAuthStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ client: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsedClient = nativeClientSchema.safeParse((await params).client);
  const parsedSearch = nativeAuthStartSearchSchema.safeParse(
    await searchParams
  );

  if (!(parsedClient.success && parsedSearch.success)) {
    notFound();
  }

  const client: NativeClient = parsedClient.data;
  const caller = await createNativeAuthCaller({
    headers: await headers(),
    source: client,
  });
  const organizations = await caller.native.auth.listOrganizations();

  return (
    <NativeAuthOrgSelect
      client={client}
      codeChallenge={parsedSearch.data.code_challenge}
      organizations={organizations}
      redirectUri={parsedSearch.data.redirect_uri}
      state={parsedSearch.data.state}
    />
  );
}
