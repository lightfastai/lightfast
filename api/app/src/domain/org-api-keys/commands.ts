import {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
  rotateOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import { z } from "zod";

import { PUBLIC_API_KEY_SCOPES } from "../../auth/api-key";
import { UNKEY_API_KEY_PREFIX } from "../../auth/api-key-prefix";
import { defineCommand } from "../command";
import { NotFoundError } from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

type OrgApiKeyMetadataValue =
  | boolean
  | null
  | number
  | string
  | OrgApiKeyMetadataValue[]
  | { [key: string]: OrgApiKeyMetadataValue };

export interface OrgApiKeyListItem {
  createdAt: number;
  enabled: boolean;
  expires?: number | null;
  identity?: { externalId?: string | null; id?: string } | null;
  keyId: string;
  lastUsedAt?: number | null;
  meta?: Record<string, OrgApiKeyMetadataValue> | null;
  name?: string | null;
  start: string;
  updatedAt?: number;
}

export interface OrgApiKeySecretResult {
  key?: string;
  keyId: string;
}

type ListOrgApiKeysResult = OrgApiKeyListItem[];
type CreateOrgApiKeyResult = OrgApiKeySecretResult;
type RotateOrgApiKeyResult = OrgApiKeySecretResult;

interface OrgApiKeyProviderClient {
  apis: {
    listKeys(input: {
      apiId: string;
      cursor?: string;
      decrypt: false;
      externalId: string;
      limit: number;
    }): Promise<{
      data: OrgApiKeyListItem[];
      pagination?: { cursor?: string; hasMore?: boolean };
    }>;
  };
  identities: {
    createIdentity(input: {
      externalId: string;
      meta: { clerkOrgId: string };
    }): Promise<unknown>;
  };
  keys: {
    createKey(input: {
      apiId: string;
      expires?: number;
      externalId: string;
      meta: { createdByUserId: string; source: "dashboard" };
      name: string;
      permissions: string[];
      prefix: string;
      recoverable: false;
    }): Promise<{ data: CreateOrgApiKeyResult }>;
    deleteKey(input: { keyId: string; permanent: false }): Promise<unknown>;
    getKey(input: {
      decrypt: false;
      keyId: string;
    }): Promise<{ data: { identity?: { externalId?: string | null } | null } }>;
    rerollKey(input: {
      expiration: number;
      keyId: string;
    }): Promise<{ data: RotateOrgApiKeyResult }>;
    updateKey(input: { enabled: false; keyId: string }): Promise<unknown>;
  };
}

export interface OrgApiKeyCommandDeps {
  apiId: string;
  isProviderConflictError(error: unknown): boolean;
  isProviderNotFoundError(error: unknown): boolean;
  log: { info(message: string, context: Record<string, unknown>): void };
  now: () => number;
  provider: OrgApiKeyProviderClient;
}

const listOrgApiKeysInput = z.object({}).strict();
const listOrgApiKeysOutput = z.custom<ListOrgApiKeysResult>(Array.isArray);
const createOrgApiKeyOutput = z.custom<CreateOrgApiKeyResult>(
  (value) => typeof value === "object" && value !== null
);
const rotateOrgApiKeyOutput = z.custom<RotateOrgApiKeyResult>(
  (value) => typeof value === "object" && value !== null
);
const successOutput = z.object({ success: z.literal(true) });

async function ensureProviderOrgIdentity(input: {
  deps: OrgApiKeyCommandDeps;
  orgId: string;
}) {
  try {
    await input.deps.provider.identities.createIdentity({
      externalId: input.orgId,
      meta: { clerkOrgId: input.orgId },
    });
  } catch (error) {
    if (input.deps.isProviderConflictError(error)) {
      return;
    }
    throw error;
  }
}

async function getOrgApiKeyForOrg(input: {
  deps: OrgApiKeyCommandDeps;
  keyId: string;
  orgId: string;
}) {
  let response: Awaited<ReturnType<OrgApiKeyProviderClient["keys"]["getKey"]>>;
  try {
    response = await input.deps.provider.keys.getKey({
      decrypt: false,
      keyId: input.keyId,
    });
  } catch (error) {
    if (input.deps.isProviderNotFoundError(error)) {
      throw new NotFoundError("ORG_API_KEY_NOT_FOUND", "API key not found.");
    }
    throw error;
  }

  if (response.data.identity?.externalId !== input.orgId) {
    throw new NotFoundError("ORG_API_KEY_NOT_FOUND", "API key not found.");
  }

  return response.data;
}

export const listOrgApiKeysCommand = defineCommand<
  "orgApiKeys.list",
  typeof listOrgApiKeysInput,
  typeof listOrgApiKeysOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.list",
  input: listOrgApiKeysInput,
  output: listOrgApiKeysOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    const keys: OrgApiKeyListItem[] = [];
    let cursor: string | undefined;

    do {
      const response = await deps.provider.apis.listKeys({
        apiId: deps.apiId,
        cursor,
        decrypt: false,
        externalId: actor.orgId,
        limit: 100,
      });

      keys.push(...response.data);
      cursor = response.pagination?.hasMore
        ? response.pagination.cursor
        : undefined;
    } while (cursor);

    return keys;
  },
});

export const createOrgApiKeyCommand = defineCommand<
  "orgApiKeys.create",
  typeof createOrgApiKeySchema,
  typeof createOrgApiKeyOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.create",
  input: createOrgApiKeySchema,
  output: createOrgApiKeyOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await ensureProviderOrgIdentity({ deps, orgId: actor.orgId });

    const expires = input.secondsUntilExpiration
      ? deps.now() + input.secondsUntilExpiration * 1000
      : undefined;
    const response = await deps.provider.keys.createKey({
      apiId: deps.apiId,
      externalId: actor.orgId,
      ...(expires ? { expires } : {}),
      meta: {
        createdByUserId: actor.userId,
        source: "dashboard",
      },
      name: input.name,
      permissions: [...PUBLIC_API_KEY_SCOPES],
      prefix: UNKEY_API_KEY_PREFIX,
      recoverable: false,
    });

    deps.log.info("[org-api-keys] created", {
      clerkOrgId: actor.orgId,
      keyId: response.data.keyId,
      name: input.name,
    });

    return response.data;
  },
});

export const revokeOrgApiKeyCommand = defineCommand<
  "orgApiKeys.revoke",
  typeof revokeOrgApiKeySchema,
  typeof successOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.revoke",
  input: revokeOrgApiKeySchema,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await getOrgApiKeyForOrg({
      deps,
      keyId: input.keyId,
      orgId: actor.orgId,
    });
    await deps.provider.keys.updateKey({
      enabled: false,
      keyId: input.keyId,
    });

    deps.log.info("[org-api-keys] revoked", {
      clerkOrgId: actor.orgId,
      keyId: input.keyId,
    });

    return { success: true as const };
  },
});

export const deleteOrgApiKeyCommand = defineCommand<
  "orgApiKeys.delete",
  typeof deleteOrgApiKeySchema,
  typeof successOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.delete",
  input: deleteOrgApiKeySchema,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await getOrgApiKeyForOrg({
      deps,
      keyId: input.keyId,
      orgId: actor.orgId,
    });
    await deps.provider.keys.deleteKey({
      keyId: input.keyId,
      permanent: false,
    });

    deps.log.info("[org-api-keys] deleted", {
      clerkOrgId: actor.orgId,
      keyId: input.keyId,
    });

    return { success: true as const };
  },
});

export const rotateOrgApiKeyCommand = defineCommand<
  "orgApiKeys.rotate",
  typeof rotateOrgApiKeySchema,
  typeof rotateOrgApiKeyOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.rotate",
  input: rotateOrgApiKeySchema,
  output: rotateOrgApiKeyOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await getOrgApiKeyForOrg({
      deps,
      keyId: input.keyId,
      orgId: actor.orgId,
    });
    const response = await deps.provider.keys.rerollKey({
      expiration: input.revokeOldAfterMs ?? 0,
      keyId: input.keyId,
    });

    deps.log.info("[org-api-keys] rotated", {
      clerkOrgId: actor.orgId,
      keyId: input.keyId,
    });

    return response.data;
  },
});
