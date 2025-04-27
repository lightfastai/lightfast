import { createClient } from "@supabase/supabase-js";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "@vendor/db/media-server/schema";

import { env } from "../env.js";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  db: { schema: DEFAULT_MEDIA_SERVER_SCHEMA },
});
