import { app } from "../src/app";

// Inngest SDK requires Node.js runtime (not Edge)
export const config = { runtime: "nodejs" } as const;

export default app.fetch;
