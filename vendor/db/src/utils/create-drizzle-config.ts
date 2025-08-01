import type { Config } from "drizzle-kit";

export const createDrizzleConfig = (opts: {
  host?: string;
  username?: string;
  password?: string;
  database?: string;
  schema: string;
  out: string;
}): Config => {
  const dbCredentials = opts.host && opts.username && opts.password && opts.database
    ? {
        host: opts.host,
        user: opts.username,
        password: opts.password,
        database: opts.database,
      }
    : undefined;

  return {
    schema: opts.schema,
    out: opts.out,
    dialect: "mysql",
    dbCredentials,
    verbose: true,
    strict: true,
  } satisfies Config;
};
