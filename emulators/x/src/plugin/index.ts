import type { ServicePlugin } from "@emulators/core";

import { X_EMULATOR_FIXTURES } from "../fixtures";
import { registerFailures, seedFailures } from "./failures";
import { registerOAuth } from "./oauth";
import { registerUsers, type XUserRow } from "./users";

export const xPlugin: ServicePlugin = {
  name: "x",
  register(app, store) {
    registerOAuth(app, store);
    registerUsers(app, store);
    registerFailures(app, store);
  },
  seed(store) {
    seedFailures(store);
    store.collection<XUserRow>("users").insert({
      name: X_EMULATOR_FIXTURES.userName,
      username: X_EMULATOR_FIXTURES.username,
      x_id: X_EMULATOR_FIXTURES.userId,
    });
  },
};
