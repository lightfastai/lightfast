import { createClient } from "@supabase/supabase-js";
import { Context } from "hono";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "@vendor/db/media-server/schema";

import { getEnv } from "../env/wrangler-env";
import { Database } from "../types/supabase.types";

export const supabase = (c: Context) =>
  createClient<Database>(getEnv(c).SUPABASE_URL, getEnv(c).SUPABASE_ANON_KEY, {
    db: { schema: DEFAULT_MEDIA_SERVER_SCHEMA },
  });
