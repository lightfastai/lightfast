import { Redis } from "@upstash/redis";

import { upstashEnv } from "../env";

export const redis = new Redis({
  url: upstashEnv.KV_REST_API_URL,
  token: upstashEnv.KV_REST_API_TOKEN,
});
