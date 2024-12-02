import type { Config } from "drizzle-kit";

const createNonPoolingUrl = (uri: string) => uri.replace(":6543", ":5432");

export const createDrizzleConfig = (opts: {
  uri?: string;
  isPoolingUrl: boolean;
  schema: string;
  out: string;
}): Config => {
  /**
   * If a uri is provided, use it as the dbCredentials.
   * Otherwise, create a non-pooling url. But if the uri is not provided,
   * we cannot determine if it is a pooling url or not. And possibly that
   * the user wants to create the migrations without a db connection.
   */
  const dbCredentials = opts.uri
    ? opts.isPoolingUrl
      ? { url: opts.uri }
      : { url: createNonPoolingUrl(opts.uri) }
    : undefined;

  return {
    schema: opts.schema,
    out: opts.out,
    dialect: "postgresql",
    dbCredentials,
    casing: "snake_case",
    verbose: true,
    strict: true,
  } satisfies Config;
};
