# Database Management

> **2026-05-06 BAREBONES RESET**: 7 tables (`org_events`, `org_entities`,
> `org_event_entities`, `org_entity_edges`, `org_ingest_logs`, `org_repo_indexes`,
> `gateway_backfill_runs`) were intentionally orphaned in Postgres — schema TS
> files were deleted but no migration was generated. The next `pnpm db:generate`
> run will produce a drop migration for these tables. Inspect the generated SQL
> before applying. Data persists physically until a future plan decides to apply
> the drop.

## Commands

```bash
cd db/cloud  # or db/chat
pnpm db:generate  # Generate migration
pnpm db:migrate   # Apply migrations  
pnpm db:studio    # Open studio
```

## IMPORTANT: Migration Rules

⚠️ **NEVER WRITE CUSTOM MIGRATION FILES** ⚠️

- Always use `pnpm db:generate` 
- Never manually create/edit `.sql` files
- Let Drizzle handle all migrations

## Troubleshooting

If `pnpm db:generate` prompts about table creation - select first option (create table).
If stuck: `git checkout HEAD -- src/migrations/meta/`