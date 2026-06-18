import { createNativeAuthAttempt } from "@api/app/tanstack/native-auth";
import {
  ArrowRightIcon as ArrowRight,
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  NativeClient,
  NativeCreateAttemptInput,
  NativeOrganization,
} from "@repo/native-auth-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { mutationOptions, useMutation } from "@tanstack/react-query";

const clientLabels = {
  cli: "Lightfast CLI",
  desktop: "Lightfast Desktop",
} satisfies Record<NativeClient, string>;

const CLERK_DEV_AUTHORIZE_HOST_SUFFIXES = [
  ".clerk.accounts.dev",
  ".accounts.dev",
];
const CLERK_DEV_BROWSER_COOKIE = "__clerk_db_jwt";
const CLERK_DEV_BROWSER_PARAM = "__clerk_db_jwt";

function getOrgInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("");
}

function readCookie(name: string) {
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  );
}

function withClerkDevBrowserContext(authorizationUrl: string) {
  const devBrowserId = readCookie(CLERK_DEV_BROWSER_COOKIE);
  if (!devBrowserId) {
    return authorizationUrl;
  }

  try {
    const url = new URL(authorizationUrl);
    if (
      !CLERK_DEV_AUTHORIZE_HOST_SUFFIXES.some((suffix) =>
        url.hostname.endsWith(suffix)
      )
    ) {
      return authorizationUrl;
    }
    url.searchParams.set(CLERK_DEV_BROWSER_PARAM, devBrowserId);
    return url.toString();
  } catch {
    return authorizationUrl;
  }
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
  const createAttemptMutation = useMutation(
    mutationOptions({
      meta: { errorTitle: "Failed to continue native authorization" },
      mutationFn: (data: NativeCreateAttemptInput) =>
        createNativeAuthAttempt({ data }),
      onSuccess: (result) => {
        window.location.assign(
          withClerkDevBrowserContext(result.authorizationUrl)
        );
      },
    })
  );

  function continueWithOrganization(organizationId: string) {
    createAttemptMutation.mutate({
      client,
      codeChallenge,
      codeChallengeMethod: "S256",
      organizationId,
      redirectUri,
      stateNonce: state,
    });
  }

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

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="font-medium text-muted-foreground text-sm">
              Organization
            </legend>
            <div className="grid gap-2">
              {organizations.map((org) => (
                <Button
                  aria-label={`Continue with ${org.name}`}
                  className="h-auto min-h-14 w-full justify-between whitespace-normal px-3 py-3 text-left"
                  disabled={createAttemptMutation.isPending}
                  key={org.id}
                  onClick={() => continueWithOrganization(org.id)}
                  type="button"
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
                  {createAttemptMutation.isPending ? (
                    <HugeiconsIcon
                      className="size-4 animate-spin text-muted-foreground"
                      icon={Loader2}
                    />
                  ) : (
                    <HugeiconsIcon
                      className="size-4 text-muted-foreground"
                      icon={ArrowRight}
                    />
                  )}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </main>
  );
}
