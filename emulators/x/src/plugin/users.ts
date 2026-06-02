import type { AppEnv, Entity, Hono, Store } from "@emulators/core";

import { X_EMULATOR_FIXTURES } from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";

export interface XUserRow extends Entity {
  name: string;
  username: string;
  x_id: string;
}

function userResponse(store: Store) {
  const user = store.collection<XUserRow>("users").all()[0];
  return {
    data: {
      id: user?.x_id ?? X_EMULATOR_FIXTURES.userId,
      name: user?.name ?? X_EMULATOR_FIXTURES.userName,
      username: user?.username ?? X_EMULATOR_FIXTURES.username,
    },
  };
}

export function registerUsers(app: Hono<AppEnv>, store: Store): void {
  app.get("/2/users/me", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).usersMe) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    return c.json(userResponse(store), 200);
  });
}
