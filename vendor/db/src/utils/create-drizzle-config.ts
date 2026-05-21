import type { Config } from "drizzle-kit";

export const createDrizzleConfig = (opts: {
  host: string;
  username: string;
  password: string;
  database?: string;
  port?: number;
  schema: string;
  out: string;
}): Config => {
  const database =
    (opts.database?.trim() === "" ? undefined : opts.database) ?? "lightfast";
  const cleanHost = stripQuotes(requiredCredential("DATABASE_HOST", opts.host));
  const cleanUsername = stripQuotes(
    requiredCredential("DATABASE_USERNAME", opts.username)
  );
  const cleanPassword = stripQuotes(
    requiredCredential("DATABASE_PASSWORD", opts.password)
  );

  return {
    schema: opts.schema,
    out: opts.out,
    dialect: "mysql",
    dbCredentials: {
      database,
      host: cleanHost,
      password: cleanPassword,
      ...(opts.port ? { port: opts.port } : {}),
      user: cleanUsername,
    },
    verbose: true,
    strict: true,
    tablesFilter: ["lightfast_*"],
  } satisfies Config;
};

function stripQuotes(value: string) {
  return value.replace(/^["']|["']$/g, "");
}

function requiredCredential(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required for Drizzle MySQL configuration.`);
  }
  return value;
}
