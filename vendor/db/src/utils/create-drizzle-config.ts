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
  const database = (opts.database?.trim() !== "" ? opts.database : undefined) ?? "lightfast";
  // Remove any quotes from all values if they exist
  const cleanHost = opts.host.replace(/^["']|["']$/g, '');
  const cleanUsername = opts.username.replace(/^["']|["']$/g, '');
  const cleanPassword = opts.password.replace(/^["']|["']$/g, '');
  
  // Use URL format for PlanetScale compatibility
  const url = `mysql://${cleanUsername}:${cleanPassword}@${cleanHost}/${database}?sslaccept=strict`;
  
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
