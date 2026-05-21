import { signalsRouter } from "./router/signals";
import { systemRouter } from "./router/system";

export const orpcRouter = {
  signals: signalsRouter,
  system: systemRouter,
};

export type OrpcRouter = typeof orpcRouter;
