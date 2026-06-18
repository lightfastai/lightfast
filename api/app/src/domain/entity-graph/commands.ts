import {
  type Database,
  getEntityAccountByPublicId,
  getEntityAccountEvidenceTrail,
  getEntityPersonByPublicId,
  getEntityPersonEvidenceTrail,
  listEntityAccounts,
  listEntityPeople,
  listEntityPersonAccountAffiliations,
} from "@db/app";
import { signalIdSchema } from "@repo/api-contract";
import { entityGraphStatusSchema } from "@repo/entity-graph-contract";
import { SIMULATED_ENTITY_SCENARIOS } from "@repo/entity-resolution";
import { z } from "zod";

import { type CommandRunArgs, defineCommand } from "../command";
import { AuthzError, NotFoundError } from "../errors";
import { requireBoundClerkOrgActor } from "../gates";

export type ListEntityPeopleResult = Awaited<
  ReturnType<typeof listEntityPeople>
>;
export type ListEntityAccountsResult = Awaited<
  ReturnType<typeof listEntityAccounts>
>;
export interface EntityPersonDetailResult {
  affiliations: Awaited<ReturnType<typeof listEntityPersonAccountAffiliations>>;
  evidenceTrail: Awaited<ReturnType<typeof getEntityPersonEvidenceTrail>>;
  person: NonNullable<Awaited<ReturnType<typeof getEntityPersonByPublicId>>>;
}
export interface EntityAccountDetailResult {
  account: NonNullable<Awaited<ReturnType<typeof getEntityAccountByPublicId>>>;
  evidenceTrail: Awaited<ReturnType<typeof getEntityAccountEvidenceTrail>>;
}
export interface IngestSimulatedEntityGraphResult {
  ingestionId: string;
  observations: number;
  status: "queued";
}
export interface RetrySignalEnrichmentResult {
  signalId: string;
  status: "queued";
}

interface SimulatedEntityScenario {
  observations: readonly unknown[];
}

export type EntityGraphInngestEvent =
  | {
      data: {
        clerkOrgId: string;
        ingestionId: string;
        observations: unknown[];
        resolverVersion: string;
      };
      id: string;
      name: "app/connector.profile.observed";
    }
  | {
      data: {
        clerkOrgId: string;
        reason: "manual_retry";
        signalId: string;
      };
      id: string;
      name: "app/signal.entity-enrichment.requested";
    };

interface EntityGraphCommandDeps {
  db: Database;
  getEntityAccountByPublicId: typeof getEntityAccountByPublicId;
  getEntityAccountEvidenceTrail: typeof getEntityAccountEvidenceTrail;
  getEntityPersonByPublicId: typeof getEntityPersonByPublicId;
  getEntityPersonEvidenceTrail: typeof getEntityPersonEvidenceTrail;
  isProduction: () => boolean;
  listEntityAccounts: typeof listEntityAccounts;
  listEntityPeople: typeof listEntityPeople;
  listEntityPersonAccountAffiliations: typeof listEntityPersonAccountAffiliations;
  now: () => Date;
  sendInngestEvent: (event: EntityGraphInngestEvent) => Promise<unknown>;
  simulatedScenarios: readonly SimulatedEntityScenario[];
}

export function createDefaultEntityGraphCommandDeps(input: {
  db: Database;
  sendInngestEvent: EntityGraphCommandDeps["sendInngestEvent"];
}): EntityGraphCommandDeps {
  return {
    db: input.db,
    getEntityAccountByPublicId,
    getEntityAccountEvidenceTrail,
    getEntityPersonByPublicId,
    getEntityPersonEvidenceTrail,
    isProduction: () => process.env.NODE_ENV === "production",
    listEntityAccounts,
    listEntityPeople,
    listEntityPersonAccountAffiliations,
    now: () => new Date(),
    sendInngestEvent: input.sendInngestEvent,
    simulatedScenarios: SIMULATED_ENTITY_SCENARIOS,
  };
}

type EntityGraphCommandRunArgs<TInput, TOutput> = CommandRunArgs<
  TInput,
  TOutput,
  EntityGraphCommandDeps
>;

const workspaceListLimitInput = z.number().int().min(1).max(100).optional();

export const listEntitiesInput = z
  .object({
    limit: workspaceListLimitInput,
    status: entityGraphStatusSchema.optional(),
  })
  .strict();

export const publicIdInput = z
  .object({
    publicId: z.string().trim().min(1),
  })
  .strict();

export const retrySignalEnrichmentInput = z
  .object({
    signalId: signalIdSchema,
  })
  .strict();

const emptyInput = z.object({}).strict();

const objectOutput = <T>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

export const listEntityPeopleCommand = defineCommand<
  "entityGraph.people.list",
  typeof listEntitiesInput,
  ReturnType<typeof objectOutput<ListEntityPeopleResult>>,
  EntityGraphCommandDeps
>({
  name: "entityGraph.people.list",
  input: listEntitiesInput,
  output: objectOutput<ListEntityPeopleResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: EntityGraphCommandRunArgs<
    z.infer<typeof listEntitiesInput>,
    ListEntityPeopleResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listEntityPeople(deps.db, {
      clerkOrgId: actor.orgId,
      limit: input.limit,
      status: input.status,
    });
  },
});

export const getEntityPersonCommand = defineCommand<
  "entityGraph.people.get",
  typeof publicIdInput,
  ReturnType<typeof objectOutput<EntityPersonDetailResult>>,
  EntityGraphCommandDeps
>({
  name: "entityGraph.people.get",
  input: publicIdInput,
  output: objectOutput<EntityPersonDetailResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: EntityGraphCommandRunArgs<
    z.infer<typeof publicIdInput>,
    EntityPersonDetailResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    const person = await deps.getEntityPersonByPublicId(deps.db, {
      clerkOrgId: actor.orgId,
      publicId: input.publicId,
    });

    if (!person) {
      throw new NotFoundError(
        "ENTITY_PERSON_NOT_FOUND",
        "Entity person not found."
      );
    }

    const [affiliations, evidenceTrail] = await Promise.all([
      deps.listEntityPersonAccountAffiliations(deps.db, {
        clerkOrgId: actor.orgId,
        limit: 100,
        personId: person.id,
      }),
      deps.getEntityPersonEvidenceTrail(deps.db, {
        canonicalKey: person.canonicalKey,
        clerkOrgId: actor.orgId,
      }),
    ]);

    return {
      affiliations,
      evidenceTrail,
      person,
    };
  },
});

export const listEntityAccountsCommand = defineCommand<
  "entityGraph.accounts.list",
  typeof listEntitiesInput,
  ReturnType<typeof objectOutput<ListEntityAccountsResult>>,
  EntityGraphCommandDeps
>({
  name: "entityGraph.accounts.list",
  input: listEntitiesInput,
  output: objectOutput<ListEntityAccountsResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: EntityGraphCommandRunArgs<
    z.infer<typeof listEntitiesInput>,
    ListEntityAccountsResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listEntityAccounts(deps.db, {
      clerkOrgId: actor.orgId,
      limit: input.limit,
      status: input.status,
    });
  },
});

export const getEntityAccountCommand = defineCommand<
  "entityGraph.accounts.get",
  typeof publicIdInput,
  ReturnType<typeof objectOutput<EntityAccountDetailResult>>,
  EntityGraphCommandDeps
>({
  name: "entityGraph.accounts.get",
  input: publicIdInput,
  output: objectOutput<EntityAccountDetailResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: EntityGraphCommandRunArgs<
    z.infer<typeof publicIdInput>,
    EntityAccountDetailResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    const account = await deps.getEntityAccountByPublicId(deps.db, {
      clerkOrgId: actor.orgId,
      publicId: input.publicId,
    });

    if (!account) {
      throw new NotFoundError(
        "ENTITY_ACCOUNT_NOT_FOUND",
        "Entity account not found."
      );
    }

    const evidenceTrail = await deps.getEntityAccountEvidenceTrail(deps.db, {
      canonicalKey: account.canonicalKey,
      clerkOrgId: actor.orgId,
    });

    return {
      account,
      evidenceTrail,
    };
  },
});

export const ingestSimulatedEntityGraphCommand = defineCommand<
  "entityGraph.dev.ingestSimulated",
  typeof emptyInput,
  ReturnType<typeof objectOutput<IngestSimulatedEntityGraphResult>>,
  EntityGraphCommandDeps
>({
  name: "entityGraph.dev.ingestSimulated",
  input: emptyInput,
  output: objectOutput<IngestSimulatedEntityGraphResult>(),
  run: async ({
    ctx,
    deps,
  }: EntityGraphCommandRunArgs<
    z.infer<typeof emptyInput>,
    IngestSimulatedEntityGraphResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    requireDevOnly(deps);

    const observations = deps.simulatedScenarios.flatMap((scenario) => [
      ...scenario.observations,
    ]);
    const ingestionId = `simulated-${deps.now().getTime()}`;
    await deps.sendInngestEvent({
      id: `entity-graph-simulated-${actor.orgId}-${ingestionId}`,
      name: "app/connector.profile.observed",
      data: {
        clerkOrgId: actor.orgId,
        ingestionId,
        observations,
        resolverVersion: "local-simulated-v1",
      },
    });

    return {
      ingestionId,
      observations: observations.length,
      status: "queued",
    };
  },
});

export const retrySignalEnrichmentCommand = defineCommand<
  "entityGraph.dev.retrySignalEnrichment",
  typeof retrySignalEnrichmentInput,
  ReturnType<typeof objectOutput<RetrySignalEnrichmentResult>>,
  EntityGraphCommandDeps
>({
  name: "entityGraph.dev.retrySignalEnrichment",
  input: retrySignalEnrichmentInput,
  output: objectOutput<RetrySignalEnrichmentResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: EntityGraphCommandRunArgs<
    z.infer<typeof retrySignalEnrichmentInput>,
    RetrySignalEnrichmentResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    requireDevOnly(deps);

    await deps.sendInngestEvent({
      id: `signal-entity-enrichment-manual-${actor.orgId}-${input.signalId}`,
      name: "app/signal.entity-enrichment.requested",
      data: {
        clerkOrgId: actor.orgId,
        reason: "manual_retry",
        signalId: input.signalId,
      },
    });

    return {
      signalId: input.signalId,
      status: "queued",
    };
  },
});

function requireDevOnly(deps: Pick<EntityGraphCommandDeps, "isProduction">) {
  if (deps.isProduction()) {
    throw new AuthzError(
      "DEV_ONLY_COMMAND",
      "This entity graph command is only available outside production."
    );
  }
}
