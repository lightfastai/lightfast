import {
  deletePreClerkNamespaceReservation,
  finalizeNamespaceOperation,
  markNamespaceOperationClerkApplied,
  NamespaceConflictError,
  reserveNamespaceForOperation,
  startNamespaceOperation,
} from "@db/app";
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";

import { isClerkConflictError } from "../../auth/clerk-errors";
import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  type AccountCommandDeps,
  createAccountUsernameCommand,
  getAccountProfileCommand,
  getGitHubAccountStatusCommand,
  startGitHubAccountBindingCommand,
  syncGitHubAccountCommand,
  updateAccountNameCommand,
} from "../../domain/account";
import {
  disconnectGitHubUserAccount,
  getGitHubUserAccountStatus,
  startGitHubUserAccountBinding,
} from "../../services/github/user-account/flow";

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

async function deps(): Promise<AccountCommandDeps> {
  const clerk = await clerkClient();
  return {
    disconnectGitHubUserAccount,
    getGitHubUserAccountStatus,
    log,
    parseError,
    startGitHubUserAccountBinding,
    usernameNamespace: {
      deletePreClerkReservation: (operation, input) =>
        deletePreClerkNamespaceReservation(db, operation, input),
      finalize: (operation) => finalizeNamespaceOperation(db, operation),
      isConflict: (error): error is NamespaceConflictError =>
        error instanceof NamespaceConflictError,
      markClerkApplied: (operation) =>
        markNamespaceOperationClerkApplied(db, operation),
      reserve: (operation) => reserveNamespaceForOperation(db, operation),
      start: (input) => startNamespaceOperation(db, input),
    },
    users: {
      getUser: (userId) => clerk.users.getUser(userId),
      isUsernameConflictError: isClerkConflictError,
      updateUser: (userId, params) => clerk.users.updateUser(userId, params),
    },
  };
}

export const getAccountProfile = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await getAccountProfileCommand.run({
        ctx: await createTanStackAccountContext(),
        deps: await deps(),
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
        deps: await deps(),
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
        deps: await deps(),
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
        deps: await deps(),
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
        deps: await deps(),
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
        deps: await deps(),
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
