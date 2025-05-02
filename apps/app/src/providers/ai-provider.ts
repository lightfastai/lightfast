import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry } from "ai";

import { env } from "~/env";

export const registry = createProviderRegistry({
  openai: createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  }),
});
