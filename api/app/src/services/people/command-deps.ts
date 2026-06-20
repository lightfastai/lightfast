import type { Database } from "@db/app";
import { getPersonByPublicId, listPeople } from "@db/app";

import type { PeopleCommandDeps } from "../../domain/people";

type PeopleCommandDepOverrides = Partial<PeopleCommandDeps>;

export function createDefaultPeopleCommandDeps(
  input: { db: Database } & PeopleCommandDepOverrides
): PeopleCommandDeps {
  return {
    getPersonByPublicId:
      input.getPersonByPublicId ??
      ((value) => getPersonByPublicId(input.db, value)),
    listPeople: input.listPeople ?? ((value) => listPeople(input.db, value)),
  };
}
