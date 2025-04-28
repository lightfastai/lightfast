import { createClient } from "@supabase/supabase-js";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "@vendor/db/media-server/schema";

import { Database } from "../types/supabase.types";

// Accepts either a Hono Context or a plain env object
export const supabase = ({
  supabaseUrl,
  supabaseAnonKey,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
}) => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    db: { schema: DEFAULT_MEDIA_SERVER_SCHEMA },
  });
};
