export * from "./types.js";
export * from "./registry.js";

// Auto-register connectors on import
import { githubBackfillConnector } from "./connectors/github.js";
import { vercelBackfillConnector } from "./connectors/vercel.js";
import { registerConnector } from "./registry.js";
registerConnector(githubBackfillConnector);
registerConnector(vercelBackfillConnector);
