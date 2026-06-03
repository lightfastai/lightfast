import type { ServicePlugin } from "@emulators/core";

import { registerFailures, seedFailures } from "./failures";
import { registerMcp } from "./mcp";
import { registerOAuth } from "./oauth";
import { registerViewer } from "./viewer";

export const linearPlugin: ServicePlugin = {
  name: "linear",
  register(app, store) {
    registerOAuth(app, store);
    registerViewer(app, store);
    registerMcp(app, store);
    registerFailures(app, store);
  },
  seed(store) {
    seedFailures(store);
  },
};
