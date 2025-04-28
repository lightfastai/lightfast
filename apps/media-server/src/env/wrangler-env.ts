import { Context } from "hono";
import { env as honoEnv } from "hono/adapter";
import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string(),
  FAL_KEY: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  DATABASE_URL: z.string(),
  SUPABASE_PROJECT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_ACCOUNT_ID: z.string(),
  R2_BUCKET_NAME: z.string(),
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number(),
  BASE_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const getEnv = (c: Context) => {
  return honoEnv<Env>(c);
};
