import { systemRouter } from "./router/system";

export const orpcRouter = {
  system: systemRouter,
};

export type OrpcRouter = typeof orpcRouter;
