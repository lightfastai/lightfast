import type { Person } from "@db/app";
import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
  personMemberStatusSchema,
  personSourceSchema,
} from "@repo/app-validation/schemas";
import { z } from "zod";

import { type CommandRunArgs, defineCommand } from "../command";
import { NotFoundError } from "../errors";
import { requireBoundClerkOrgActor } from "../gates";

export type PersonDetailResult = Person;

export interface ListPeopleResult {
  items: PersonDetailResult[];
  nextCursor: { createdAt: Date; id: number } | null;
}

const cursorCreatedAtSchema = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((value) => new Date(value)),
]);

const workspaceListCursorInput = z
  .object({
    createdAt: cursorCreatedAtSchema,
    id: z.number().int().positive(),
  })
  .nullish();

const workspaceListLimitInput = z.number().int().min(1).max(100).optional();
const workspaceListSearchInput = z
  .string()
  .trim()
  .max(200)
  .transform((value) => value || undefined)
  .optional();

export const listPeopleInput = z
  .object({
    cursor: workspaceListCursorInput,
    limit: workspaceListLimitInput,
    memberStatuses: z.array(personMemberStatusSchema).max(2).optional(),
    providers: z.array(peopleIdentityProviderSchema).max(5).optional(),
    search: workspaceListSearchInput,
    sources: z.array(personSourceSchema).max(3).optional(),
    types: z.array(peopleIdentityTypeSchema).max(3).optional(),
  })
  .strict();

const getPersonInput = z
  .object({
    publicId: z.string().trim().min(1),
  })
  .strict();

const objectOutput = <T>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

export interface PeopleCommandDeps {
  getPersonByPublicId(input: {
    clerkOrgId: string;
    publicId: string;
  }): Promise<PersonDetailResult | undefined>;
  listPeople(input: {
    clerkOrgId: string;
    cursor?: z.infer<typeof workspaceListCursorInput>;
    limit?: number;
    memberStatuses?: z.infer<typeof personMemberStatusSchema>[];
    providers?: z.infer<typeof peopleIdentityProviderSchema>[];
    search?: string;
    sources?: z.infer<typeof personSourceSchema>[];
    types?: z.infer<typeof peopleIdentityTypeSchema>[];
  }): Promise<ListPeopleResult>;
}

type PeopleCommandRunArgs<TInput, TOutput> = CommandRunArgs<
  TInput,
  TOutput,
  PeopleCommandDeps
>;

export const listPeopleCommand = defineCommand<
  "people.list",
  typeof listPeopleInput,
  ReturnType<typeof objectOutput<ListPeopleResult>>,
  PeopleCommandDeps
>({
  name: "people.list",
  input: listPeopleInput,
  output: objectOutput<ListPeopleResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: PeopleCommandRunArgs<
    z.infer<typeof listPeopleInput>,
    ListPeopleResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    const search = input.search?.trim() || undefined;
    return deps.listPeople({
      clerkOrgId: actor.orgId,
      cursor: input.cursor,
      limit: input.limit,
      memberStatuses: input.memberStatuses?.length
        ? input.memberStatuses
        : undefined,
      providers: input.providers?.length ? input.providers : undefined,
      search,
      sources: input.sources?.length ? input.sources : undefined,
      types: input.types?.length ? input.types : undefined,
    });
  },
});

export const getPersonCommand = defineCommand<
  "people.get",
  typeof getPersonInput,
  ReturnType<typeof objectOutput<PersonDetailResult>>,
  PeopleCommandDeps
>({
  name: "people.get",
  input: getPersonInput,
  output: objectOutput<PersonDetailResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: PeopleCommandRunArgs<
    z.infer<typeof getPersonInput>,
    PersonDetailResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    const person = await deps.getPersonByPublicId({
      clerkOrgId: actor.orgId,
      publicId: input.publicId,
    });

    if (!person) {
      throw new NotFoundError("PERSON_NOT_FOUND", "Person not found.");
    }

    return person;
  },
});
