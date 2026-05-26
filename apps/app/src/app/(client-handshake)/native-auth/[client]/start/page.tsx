import {
  type NativeClient,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { createNativeAuthCaller } from "~/app/api/native-auth/_server/native-auth-caller";

import { NativeAuthOrgSelect } from "./_components/native-auth-org-select";
import { nativeAuthStartSearchSchema } from "./validators";

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
