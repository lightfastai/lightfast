import type { Config } from "drizzle-kit";

export const createDrizzleConfig = (opts: {
  database: string;
  host?: string;
  username?: string;
  password?: string;
  schema: string;
  out: string;
  tablesFilter?: string | string[];
}): Config => {
  const database = stripQuotes(opts.database);
  const host = stripQuotes(opts.host);
  const username = stripQuotes(opts.username);
  const password = stripQuotes(opts.password);
  const hasCredentials = Boolean(host && username && password);
  if (hasCredentials && !database) {
    throw new Error(
      "Drizzle database name is required when credentials exist."
    );
  }

  return {
    schema: opts.schema,
    out: opts.out,
    dialect: "mysql",
    ...(hasCredentials
      ? {
          dbCredentials: {
            url: createDatabaseUrl({
              database: database!,
              host: host!,
              password: password!,
              username: username!,
            }),
          },
        }
      : {}),
    verbose: true,
    strict: true,
    ...(opts.tablesFilter ? { tablesFilter: opts.tablesFilter } : {}),
  } satisfies Config;
};

function stripQuotes(value: string | undefined) {
  return value?.replace(/^["']|["']$/g, "");
}

function createDatabaseUrl(opts: {
  database: string;
  host: string;
  username: string;
  password: string;
}) {
  const username = encodeURIComponent(opts.username);
  const password = encodeURIComponent(opts.password);

  return `mysql://${username}:${password}@${opts.host}/${opts.database}`;
}
