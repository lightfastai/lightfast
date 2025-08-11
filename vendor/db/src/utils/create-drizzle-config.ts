import type { Config } from "drizzle-kit";

export const createDrizzleConfig = (opts: {
  host: string;
  username: string;
  password: string;
  database?: string;
  schema: string;
  out: string;
}): Config => {
  // Construct DATABASE_URL for PlanetScale
  const database = opts.database || "lightfast";
  const url = `mysql://${opts.username}:${opts.password}@${opts.host}/${database}?ssl={"rejectUnauthorized":true}`;
  
  return {
    schema: opts.schema,
    out: opts.out,
    dialect: "mysql",
    dbCredentials: {
      url,
    },
    verbose: true,
    strict: true,
    tablesFilter: ["lightfast_*"], // Optional: filter tables by prefix
  } satisfies Config;
};
