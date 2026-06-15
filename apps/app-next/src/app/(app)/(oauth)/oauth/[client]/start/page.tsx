import {
  type NativeClient,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { notFound } from "next/navigation";
import { getQueryClient, trpc } from "~/trpc/server";

import { NativeAuthOrgSelect } from "./_components/native-auth-org-select";
import { nativeAuthStartSearchSchema } from "./validators";

export const dynamic = "force-dynamic";

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
  const organizations = await getQueryClient().fetchQuery(
    trpc.native.auth.listOrganizations.queryOptions()
  );

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
