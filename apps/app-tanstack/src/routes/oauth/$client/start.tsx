import {
  type NativeClient,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { loadNativeAuthOrganizations } from "~/oauth/native-auth-functions";
import { NativeAuthOrgSelect } from "~/oauth/native-auth-org-select";
import { validateNativeAuthStartSearch } from "~/oauth/native-auth-validators";

export const Route = createFileRoute("/oauth/$client/start")({
  validateSearch: validateNativeAuthStartSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params }) => {
    const client = parseNativeClient(params.client);
    const organizations = await loadNativeAuthOrganizations({
      data: { ...deps, client },
    });
    return {
      client,
      codeChallenge: deps.code_challenge,
      organizations,
      redirectUri: deps.redirect_uri,
      state: deps.state,
    };
  },
  head: ({ params }) => ({
    meta: [{ title: `${params.client} OAuth - Lightfast` }],
  }),
  component: NativeAuthStartPage,
});

function NativeAuthStartPage() {
  const { client, codeChallenge, organizations, redirectUri, state } =
    Route.useLoaderData();

  return (
    <div className="flex min-h-svh w-full justify-center bg-background px-4 py-10 text-foreground">
      <NativeAuthOrgSelect
        client={client}
        codeChallenge={codeChallenge}
        organizations={organizations}
        redirectUri={redirectUri}
        state={state}
      />
    </div>
  );
}

function parseNativeClient(value: string): NativeClient {
  const parsed = nativeClientSchema.safeParse(value);
  if (!parsed.success) {
    throw notFound();
  }
  return parsed.data;
}
