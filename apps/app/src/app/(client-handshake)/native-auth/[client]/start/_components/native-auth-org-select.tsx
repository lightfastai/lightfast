import type {
  NativeClient,
  NativeOrganization,
} from "@repo/native-auth-contract";

import { continueNativeAuth } from "../actions";

export function NativeAuthOrgSelect({
  client,
  codeChallenge,
  organizations,
  redirectUri,
  state,
}: {
  client: NativeClient;
  codeChallenge: string;
  organizations: NativeOrganization[];
  redirectUri: string;
  state: string;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-6 py-10">
      <h1 className="font-semibold text-2xl">
        Choose a Lightfast organization
      </h1>
      <form action={continueNativeAuth} className="mt-6 grid gap-2">
        <input name="client" type="hidden" value={client} />
        <input name="redirect_uri" type="hidden" value={redirectUri} />
        <input name="state" type="hidden" value={state} />
        <input name="code_challenge" type="hidden" value={codeChallenge} />
        <input name="code_challenge_method" type="hidden" value="S256" />
        {organizations.map((org) => (
          <button
            className="flex min-h-14 w-full items-center justify-between rounded-md border px-4 text-left transition-colors hover:bg-muted"
            key={org.id}
            name="organization_id"
            type="submit"
            value={org.id}
          >
            <span className="font-medium">{org.name}</span>
            {org.slug ? (
              <span className="text-muted-foreground text-sm">{org.slug}</span>
            ) : null}
          </button>
        ))}
      </form>
    </main>
  );
}
