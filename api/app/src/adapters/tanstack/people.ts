import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import type { z } from "zod";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  type ListPeopleResult as DomainListPeopleResult,
  type PersonDetailResult as DomainPersonDetailResult,
  getPersonCommand,
  listPeopleCommand,
} from "../../domain/people";
import { createDefaultPeopleCommandDeps } from "../../services/people/command-deps";

export type ListPeopleInput = z.input<typeof listPeopleCommand.input>;
export type GetPersonInput = z.input<typeof getPersonCommand.input>;

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

export type PersonResult = Omit<DomainPersonDetailResult, "metadata"> & {
  metadata: SerializableMetadata;
};

export interface ListPeopleResult {
  items: PersonResult[];
  nextCursor: DomainListPeopleResult["nextCursor"];
}

export type PersonDetailResult = PersonResult;

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackPeopleContext() {
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

function toSerializableMetadata(
  value: DomainPersonDetailResult["metadata"]
): SerializableMetadata {
  const metadata = toSerializableValue(value);
  return metadata && !Array.isArray(metadata) && typeof metadata === "object"
    ? metadata
    : {};
}

function serializePerson(person: DomainPersonDetailResult): PersonResult {
  return {
    ...person,
    metadata: toSerializableMetadata(person.metadata),
  };
}

function serializePeopleList(result: DomainListPeopleResult): ListPeopleResult {
  return {
    items: result.items.map(serializePerson),
    nextCursor: result.nextCursor,
  };
}

export const listPeople = createServerFn({ method: "GET" })
  .inputValidator(listPeopleCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const result = await listPeopleCommand.run({
        ctx: await createTanStackPeopleContext(),
        deps: createDefaultPeopleCommandDeps({ db }),
        input: data,
      });
      return serializePeopleList(result);
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const getPerson = createServerFn({ method: "GET" })
  .inputValidator(getPersonCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const person = await getPersonCommand.run({
        ctx: await createTanStackPeopleContext(),
        deps: createDefaultPeopleCommandDeps({ db }),
        input: data,
      });
      return serializePerson(person);
    } catch (error) {
      mapTanStackError(error);
    }
  });
