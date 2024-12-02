import type { NeonClient, NeonDatabase } from "drizzle-orm/neon-serverless";

export interface Db extends NeonDatabase<Record<string, never>> {
  $client: NeonClient;
}
