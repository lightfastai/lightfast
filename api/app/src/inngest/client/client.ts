import { resolveWorktreeRuntimeName } from "@lightfastai/dev-core";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { createInngestObservabilityMiddleware } from "@vendor/observability/inngest";
import type { GetEvents } from "inngest";

import { env } from "../../env";
import { appEvents } from "../schemas/app";

// Local development can run multiple git worktrees against one Inngest Dev
// Server. Suffix the app id with the worktree identity so those registrations
// do not collapse into the same Inngest app; preview/production keep the stable
// configured name.
const appId =
  env.VERCEL_ENV === "development"
    ? resolveWorktreeRuntimeName(env.INNGEST_APP_NAME)
    : env.INNGEST_APP_NAME;

const inngest = new Inngest({
  id: appId,
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromSchema(appEvents),
  middleware: [createInngestObservabilityMiddleware()],
});

export type Events = GetEvents<typeof inngest>;
export { inngest };
