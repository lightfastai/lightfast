import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const secureApiRequestEnv = createEnv({
	shared: {},
	server: {
		REQUEST_ID_SECRET: z.string().min(1).optional(),
	},
	client: {},
	experimental__runtimeEnv: {},
	skipValidation:
		!!process.env.CI || process.env.npm_lifecycle_event === "lint",
});