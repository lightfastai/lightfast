import { db } from "@db/app/client";
import {
  type SkillDiagnostic,
  skillValidationStatusSchema,
} from "@repo/skills-contract";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import { requireBoundClerkOrgActor } from "../../domain/gates";
import {
  getSkillIndexSnapshot,
  getVerifiedLightfastSkillSourceRepositoryId,
  requestSkillIndexRefresh,
} from "../../services/skills";

const listSkillsInput = z
  .object({
    validationStatus: skillValidationStatusSchema.optional(),
  })
  .strict()
  .optional();

const requestSkillRefreshInput = z.object({}).strict().optional();

type SkillIndexSnapshot = Awaited<ReturnType<typeof getSkillIndexSnapshot>>;

type SerializableValue =
  | SerializableValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: SerializableValue };

export type SkillDiagnosticResult = Omit<SkillDiagnostic, "details"> & {
  details?: SerializableValue;
};

export type SkillResult = Omit<
  SkillIndexSnapshot["skills"][number],
  "diagnostics"
> & {
  diagnostics: SkillDiagnosticResult[];
};

export interface ListSkillsResult
  extends Omit<SkillIndexSnapshot, "indexDiagnostics" | "skills"> {
  indexDiagnostics: SkillDiagnosticResult[];
  skills: SkillResult[];
}

export interface RequestSkillRefreshResult {
  enqueued: boolean;
}

function requestId() {
  return crypto.randomUUID();
}

async function getBoundActor() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  return requireBoundClerkOrgActor({
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" },
  });
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

function serializeDiagnostic(
  diagnostic: SkillDiagnostic
): SkillDiagnosticResult {
  const { details, ...rest } = diagnostic;
  if (details === undefined) {
    return rest;
  }

  return {
    ...rest,
    details: toSerializableValue(details),
  };
}

function serializeSkill(
  skill: SkillIndexSnapshot["skills"][number]
): SkillResult {
  return {
    ...skill,
    diagnostics: skill.diagnostics.map(serializeDiagnostic),
  };
}

function serializeSnapshot(snapshot: SkillIndexSnapshot): ListSkillsResult {
  return {
    ...snapshot,
    indexDiagnostics: snapshot.indexDiagnostics.map(serializeDiagnostic),
    skills: snapshot.skills.map(serializeSkill),
  };
}

export const listSkills = createServerFn({ method: "GET" })
  .inputValidator(listSkillsInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      const sourceControlRepositoryId =
        await getVerifiedLightfastSkillSourceRepositoryId(db, {
          clerkOrgId: actor.orgId,
        });
      const result = await getSkillIndexSnapshot({
        clerkOrgId: actor.orgId,
        sourceControlRepositoryId,
      });

      return serializeSnapshot({
        ...result,
        skills: data?.validationStatus
          ? result.skills.filter(
              (skill) => skill.validationStatus === data.validationStatus
            )
          : result.skills,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const requestSkillRefresh = createServerFn({ method: "POST" })
  .inputValidator(requestSkillRefreshInput)
  .handler(async () => {
    noStore();
    try {
      const actor = await getBoundActor();
      const sourceControlRepositoryId =
        await getVerifiedLightfastSkillSourceRepositoryId(db, {
          clerkOrgId: actor.orgId,
        });
      const result = await requestSkillIndexRefresh({
        clerkOrgId: actor.orgId,
        reason: "read",
        sourceControlRepositoryId,
      });

      return { enqueued: result.enqueued };
    } catch (error) {
      mapTanStackError(error);
    }
  });
