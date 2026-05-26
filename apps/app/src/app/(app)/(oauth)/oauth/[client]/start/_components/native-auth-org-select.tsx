import type {
  NativeClient,
  NativeOrganization,
} from "@repo/native-auth-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";

import { continueNativeAuth } from "../actions";

const clientLabels = {
  cli: "Lightfast CLI",
  desktop: "Lightfast Desktop",
} satisfies Record<NativeClient, string>;

function getOrgInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");
}

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
    <main className="w-full max-w-md space-y-4">
      <div className="w-fit rounded-sm bg-card p-3">
        <Icons.logoShort className="h-5 w-5 text-foreground" />
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <p className="font-mono text-muted-foreground text-sm">
            {clientLabels[client]}
          </p>
          <h1 className="pb-2 font-medium font-pp text-2xl text-foreground">
            Choose a Lightfast organization
          </h1>
        </div>

        <form action={continueNativeAuth} className="space-y-4">
          <input name="client" type="hidden" value={client} />
          <input name="redirect_uri" type="hidden" value={redirectUri} />
          <input name="state" type="hidden" value={state} />
          <input name="code_challenge" type="hidden" value={codeChallenge} />
          <input name="code_challenge_method" type="hidden" value="S256" />

          <fieldset className="space-y-2">
            <legend className="font-medium text-muted-foreground text-sm">
              Organization
            </legend>
            <div className="grid gap-2">
              {organizations.map((org) => (
                <Button
                  aria-label={`Continue with ${org.name}`}
                  className="h-auto min-h-14 w-full justify-between whitespace-normal px-3 py-3 text-left"
                  key={org.id}
                  name="organization_id"
                  type="submit"
                  value={org.id}
                  variant="outline"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-card font-medium text-foreground text-sm ring-1 ring-border"
                    >
                      {getOrgInitials(org.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {org.name}
                      </span>
                      {org.slug ? (
                        <span className="block truncate font-mono text-muted-foreground text-xs">
                          lightfast.ai/
                          <span className="text-foreground">{org.slug}</span>
                        </span>
                      ) : (
                        <span className="block truncate font-mono text-muted-foreground text-xs">
                          {org.role}
                        </span>
                      )}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
