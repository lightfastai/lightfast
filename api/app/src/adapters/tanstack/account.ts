import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createAccountUsernameCommand,
  createDefaultAccountCommandDeps,
  getAccountProfileCommand,
  getGitHubAccountStatusCommand,
  startGitHubAccountBindingCommand,
  syncGitHubAccountCommand,
  updateAccountNameCommand,
} from "../../domain/account";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackAccountContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });

  return {
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" as const },
  };
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

export const getAccountProfile = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await getAccountProfileCommand.run({
        ctx: await createTanStackAccountContext(),
        deps: await createDefaultAccountCommandDeps({ db }),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const updateAccountName = createServerFn({ method: "POST" })
  .inputValidator(updateAccountNameCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await updateAccountNameCommand.run({
        ctx: await createTanStackAccountContext(),
        deps: await createDefaultAccountCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const createAccountUsername = createServerFn({ method: "POST" })
  .inputValidator(createAccountUsernameCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await createAccountUsernameCommand.run({
        ctx: await createTanStackAccountContext(),
        deps: await createDefaultAccountCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const getGitHubAccountStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await getGitHubAccountStatusCommand.run({
        ctx: await createTanStackAccountContext(),
        deps: await createDefaultAccountCommandDeps({ db }),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const startGitHubAccountBinding = createServerFn({ method: "POST" })
  .inputValidator(startGitHubAccountBindingCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await startGitHubAccountBindingCommand.run({
        ctx: await createTanStackAccountContext(),
        deps: await createDefaultAccountCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const syncGitHubAccount = createServerFn({ method: "POST" }).handler(
  async () => {
    noStore();
    try {
      return await syncGitHubAccountCommand.run({
        ctx: await createTanStackAccountContext(),
        deps: await createDefaultAccountCommandDeps({ db }),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export type GitHubAccountStatusResult = Awaited<
  ReturnType<typeof getGitHubAccountStatus>
>;
export type GitHubUserAccount = NonNullable<
  GitHubAccountStatusResult["account"]
>;
