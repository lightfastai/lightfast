import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createDatabase, sql } from "@vendor/db";
import { env } from "./env";

const MIGRATIONS_DIR = "./src/migrations";

const through = process.argv
  .find((arg) => arg.startsWith("--through="))
  ?.split("=")[1];

const db = createDatabase({
  host: env.DATABASE_HOST,
  password: env.DATABASE_PASSWORD,
  username: env.DATABASE_USERNAME,
});

const journal = JSON.parse(
  readFileSync(`${MIGRATIONS_DIR}/meta/_journal.json`, "utf8")
) as { entries: { tag: string; when: number }[] };

const entries = through ? entriesThrough(through) : journal.entries;

await db.execute(sql`
  create table if not exists \`__drizzle_migrations\` (
    id serial primary key,
    hash text not null,
    created_at bigint
  )
`);

for (const entry of entries) {
  const file = readFileSync(`${MIGRATIONS_DIR}/${entry.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(file).digest("hex");

  const existing = await db.execute(
    sql`select 1 from \`__drizzle_migrations\` where created_at = ${entry.when} limit 1`
  );

  if (existing.rows.length === 0) {
    await db.execute(
      sql`insert into \`__drizzle_migrations\` (\`hash\`, \`created_at\`)
          values (${hash}, ${entry.when})`
    );
  }
}

console.log(
  `Baseline complete: ${entries.length} migration(s) marked applied.`
);

function entriesThrough(tag: string) {
  const index = journal.entries.findIndex((entry) => entry.tag === tag);
  if (index === -1) {
    throw new Error(`Migration tag not found in journal: ${tag}`);
  }
  return journal.entries.slice(0, index + 1);
}
