import { SIMULATED_ENTITY_SCENARIOS } from "@repo/entity-resolution";

import {
  db,
  ingestEntityObservations,
  listEntityAccounts,
  listEntityPeople,
} from "../index";

const clerkOrgId =
  process.env.ENTITY_GRAPH_CLERK_ORG_ID ?? "org_local_entity_graph";
const resolverVersion = "local-simulated-v1";

const summary = await ingestEntityObservations(db, {
  clerkOrgId,
  observations: SIMULATED_ENTITY_SCENARIOS.flatMap(
    (scenario) => scenario.observations
  ),
  resolverVersion,
});
const [people, accounts] = await Promise.all([
  listEntityPeople(db, { clerkOrgId, limit: 25 }),
  listEntityAccounts(db, { clerkOrgId, limit: 25 }),
]);

process.stdout.write(
  `${JSON.stringify(
    {
      accounts: accounts.map((account) => ({
        canonicalKey: account.canonicalKey,
        displayName: account.displayName,
        primaryDomain: account.primaryDomain,
        status: account.status,
      })),
      clerkOrgId,
      people: people.map((person) => ({
        canonicalKey: person.canonicalKey,
        displayName: person.displayName,
        status: person.status,
      })),
      summary,
    },
    null,
    2
  )}\n`
);
