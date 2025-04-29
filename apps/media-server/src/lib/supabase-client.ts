import { createBrowserClient } from "@supabase/ssr";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "@vendor/db/media-server/schema";

import { env } from "~/env/node-env";
import { Database } from "../types/supabase.types";

export const createClient = () => {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: DEFAULT_MEDIA_SERVER_SCHEMA },
    },
  );
};
