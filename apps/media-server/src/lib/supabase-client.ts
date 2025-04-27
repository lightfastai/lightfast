import { createClient } from "@supabase/supabase-js";

import { env } from "../env.js";

// Use the service role key for server-side operations
const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const schema = env.SUPABASE_SCHEMA;

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  db: { schema },
});
