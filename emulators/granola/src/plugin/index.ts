import type { ServicePlugin } from "@emulators/core";

import { registerFailures, seedFailures } from "./failures";
import { registerMcp } from "./mcp";
import { registerOAuth } from "./oauth";

export const granolaPlugin: ServicePlugin = {
  name: "granola",
  register(app, store) {
    registerOAuth(app, store);
    registerMcp(app, store);
    registerFailures(app, store);
  },
  seed(store) {
    seedFailures(store);
  },
};
