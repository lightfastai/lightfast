import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultEntityGraphCommandDeps,
  type EntityAccountDetailResult as DomainEntityAccountDetailResult,
  type EntityPersonDetailResult as DomainEntityPersonDetailResult,
  type ListEntityAccountsResult as DomainListEntityAccountsResult,
  type ListEntityPeopleResult as DomainListEntityPeopleResult,
  type EntityGraphInngestEvent,
  getEntityAccountCommand,
  getEntityPersonCommand,
  ingestSimulatedEntityGraphCommand,
  listEntityAccountsCommand,
  listEntityPeopleCommand,
  retrySignalEnrichmentCommand,
} from "../../domain/entity-graph";

type SerializableValue =
  | SerializableValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: SerializableValue };

interface SerializableMetadata {
  [key: string]: SerializableValue;
}

type SerializableMetadataRow<T extends { metadata: unknown }> = Omit<
  T,
  "metadata"
> & {
  metadata: SerializableMetadata;
};

type DomainEntityPerson = DomainListEntityPeopleResult[number];
type DomainEntityAccount = DomainListEntityAccountsResult[number];
type DomainEntityAffiliation =
  DomainEntityPersonDetailResult["affiliations"][number];
type DomainEntityCandidateGroup = NonNullable<
  DomainEntityPersonDetailResult["evidenceTrail"]["candidateGroup"]
>;
type DomainEntityCandidateVersion =
  DomainEntityPersonDetailResult["evidenceTrail"]["candidateVersions"][number];

export type EntityPersonResult = SerializableMetadataRow<DomainEntityPerson>;
export type EntityAccountResult = SerializableMetadataRow<DomainEntityAccount>;
type EntityAffiliationResult = SerializableMetadataRow<DomainEntityAffiliation>;
type EntityCandidateGroupResult =
  SerializableMetadataRow<DomainEntityCandidateGroup>;
type EntityCandidateVersionResult = Omit<
  SerializableMetadataRow<DomainEntityCandidateVersion>,
  "outputJson"
> & {
  outputJson: SerializableMetadata;
};

type EntityPersonEvidenceTrailResult = Omit<
  DomainEntityPersonDetailResult["evidenceTrail"],
  "candidateGroup" | "candidateVersions" | "person"
> & {
  candidateGroup: EntityCandidateGroupResult | undefined;
  candidateVersions: EntityCandidateVersionResult[];
  person: EntityPersonResult | undefined;
};

type EntityAccountEvidenceTrailResult = Omit<
  DomainEntityAccountDetailResult["evidenceTrail"],
  "account" | "candidateGroup" | "candidateVersions"
> & {
  account: EntityAccountResult | undefined;
  candidateGroup: EntityCandidateGroupResult | undefined;
  candidateVersions: EntityCandidateVersionResult[];
};

export interface EntityPersonDetailResult {
  affiliations: EntityAffiliationResult[];
  evidenceTrail: EntityPersonEvidenceTrailResult;
  person: EntityPersonResult;
}

export interface EntityAccountDetailResult {
  account: EntityAccountResult;
  evidenceTrail: EntityAccountEvidenceTrailResult;
}

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackEntityGraphContext() {
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

async function sendInngestEvent(event: EntityGraphInngestEvent) {
  const { inngest } = await import("../../inngest/client");
  await inngest.send(event);
}

function deps() {
  return createDefaultEntityGraphCommandDeps({
    db,
    sendInngestEvent,
  });
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    const mappedError = new Error(error.message, { cause: error });
    mappedError.name = "DomainError";
    throw mappedError;
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

function toSerializableValue(value: unknown): SerializableValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toSerializableValue);
  }

  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        toSerializableValue(child),
      ])
    );
  }

  return null;
}

function toSerializableMetadata(value: unknown): SerializableMetadata {
  const metadata = toSerializableValue(value);
  return metadata && !Array.isArray(metadata) && typeof metadata === "object"
    ? metadata
    : {};
}

function serializeMetadataRow<T extends { metadata: unknown }>(
  row: T
): SerializableMetadataRow<T> {
  return {
    ...row,
    metadata: toSerializableMetadata(row.metadata),
  };
}

function serializeCandidateVersion(
  version: DomainEntityCandidateVersion
): EntityCandidateVersionResult {
  return {
    ...version,
    metadata: toSerializableMetadata(version.metadata),
    outputJson: toSerializableMetadata(version.outputJson),
  };
}

function serializePersonEvidenceTrail(
  evidenceTrail: DomainEntityPersonDetailResult["evidenceTrail"]
): EntityPersonEvidenceTrailResult {
  return {
    ...evidenceTrail,
    candidateGroup: evidenceTrail.candidateGroup
      ? serializeMetadataRow(evidenceTrail.candidateGroup)
      : undefined,
    candidateVersions: evidenceTrail.candidateVersions.map(
      serializeCandidateVersion
    ),
    person: evidenceTrail.person
      ? serializeMetadataRow(evidenceTrail.person)
      : undefined,
  };
}

function serializeAccountEvidenceTrail(
  evidenceTrail: DomainEntityAccountDetailResult["evidenceTrail"]
): EntityAccountEvidenceTrailResult {
  return {
    ...evidenceTrail,
    account: evidenceTrail.account
      ? serializeMetadataRow(evidenceTrail.account)
      : undefined,
    candidateGroup: evidenceTrail.candidateGroup
      ? serializeMetadataRow(evidenceTrail.candidateGroup)
      : undefined,
    candidateVersions: evidenceTrail.candidateVersions.map(
      serializeCandidateVersion
    ),
  };
}

function serializePersonDetail(
  detail: DomainEntityPersonDetailResult
): EntityPersonDetailResult {
  return {
    affiliations: detail.affiliations.map(serializeMetadataRow),
    evidenceTrail: serializePersonEvidenceTrail(detail.evidenceTrail),
    person: serializeMetadataRow(detail.person),
  };
}

function serializeAccountDetail(
  detail: DomainEntityAccountDetailResult
): EntityAccountDetailResult {
  return {
    account: serializeMetadataRow(detail.account),
    evidenceTrail: serializeAccountEvidenceTrail(detail.evidenceTrail),
  };
}

export const listEntityPeople = createServerFn({ method: "GET" })
  .inputValidator(listEntityPeopleCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const result = await listEntityPeopleCommand.run({
        ctx: await createTanStackEntityGraphContext(),
        deps: deps(),
        input: data,
      });
      return result.map(serializeMetadataRow);
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const getEntityPerson = createServerFn({ method: "GET" })
  .inputValidator(getEntityPersonCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const result = await getEntityPersonCommand.run({
        ctx: await createTanStackEntityGraphContext(),
        deps: deps(),
        input: data,
      });
      return serializePersonDetail(result);
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const listEntityAccounts = createServerFn({ method: "GET" })
  .inputValidator(listEntityAccountsCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const result = await listEntityAccountsCommand.run({
        ctx: await createTanStackEntityGraphContext(),
        deps: deps(),
        input: data,
      });
      return result.map(serializeMetadataRow);
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const getEntityAccount = createServerFn({ method: "GET" })
  .inputValidator(getEntityAccountCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const result = await getEntityAccountCommand.run({
        ctx: await createTanStackEntityGraphContext(),
        deps: deps(),
        input: data,
      });
      return serializeAccountDetail(result);
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const ingestSimulatedEntityGraph = createServerFn({
  method: "POST",
}).handler(async () => {
  noStore();
  try {
    return await ingestSimulatedEntityGraphCommand.run({
      ctx: await createTanStackEntityGraphContext(),
      deps: deps(),
      input: {},
    });
  } catch (error) {
    mapTanStackError(error);
  }
});

export const retrySignalEnrichment = createServerFn({ method: "POST" })
  .inputValidator(retrySignalEnrichmentCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await retrySignalEnrichmentCommand.run({
        ctx: await createTanStackEntityGraphContext(),
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListEntityPeopleResult = EntityPersonResult[];
export type ListEntityAccountsResult = EntityAccountResult[];
