// Relations between tables for Drizzle ORM queries.
//
// All gateway/org-integrations relations were removed in the v2 barebones reset.
// Surviving tables (lightfast_org_user_activities) have no inter-table FK
// relationships — they reference Clerk org IDs as opaque strings.
//
// New relations should be declared here as features land.
export {};
