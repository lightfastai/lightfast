import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../env";

export const openai = createOpenAI({
	apiKey: env.OPENAI_API_KEY ?? "",
});

// Model aliases for easy usage
export const openaiModels = {
	gpt4: "gpt-4",
	gpt4Turbo: "gpt-4-turbo",
	gpt35Turbo: "gpt-3.5-turbo",
	gpt4o: "gpt-4o",
	gpt4oMini: "gpt-4o-mini",
} as const;
