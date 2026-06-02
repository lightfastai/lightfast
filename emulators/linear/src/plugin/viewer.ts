import type { AppEnv, Hono, Store } from "@emulators/core";

import { LINEAR_EMULATOR_FIXTURES } from "../fixtures";
import { isValidBearer } from "./auth";

function viewerResponse() {
  return {
    data: {
      viewer: {
        id: LINEAR_EMULATOR_FIXTURES.actorId,
        name: LINEAR_EMULATOR_FIXTURES.actorName,
        organization: {
          id: LINEAR_EMULATOR_FIXTURES.workspaceId,
          name: LINEAR_EMULATOR_FIXTURES.workspaceName,
        },
      },
    },
  };
}

export function registerViewer(app: Hono<AppEnv>, store: Store): void {
  app.get("/viewer", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ error: "invalid_token" }, 401);
    }
    return c.json(viewerResponse(), 200);
  });

  app.post("/graphql", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ error: "invalid_token" }, 401);
    }
    return c.json(viewerResponse(), 200);
  });
}
