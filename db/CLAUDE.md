# Database Management

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