import type { Config } from "drizzle-kit";

export const createDrizzleConfig = (opts: {
  host?: string;
  username?: string;
  password?: string;
  database?: string;
  port?: number;
  schema: string;
  out: string;
}): Config => {
  const database =
    (opts.database?.trim() === "" ? undefined : opts.database) ?? "lightfast";
  const host = stripQuotes(opts.host);
  const username = stripQuotes(opts.username);
  const password = stripQuotes(opts.password);
  const hasCredentials = Boolean(host && username && password);

  return {
    schema: opts.schema,
    out: opts.out,
    dialect: "mysql",
    ...(hasCredentials
      ? {
          dbCredentials: {
            database,
            host: host!,
            password: password!,
            ...(opts.port ? { port: opts.port } : {}),
            user: username!,
          },
        }
      : {}),
    verbose: true,
    strict: true,
    tablesFilter: ["lightfast_*"],
  } satisfies Config;
};

function stripQuotes(value: string | undefined) {
  return value?.replace(/^["']|["']$/g, "");
}
