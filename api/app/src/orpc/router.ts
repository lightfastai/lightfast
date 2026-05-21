import { opportunitiesRouter } from "./router/opportunities";
import { systemRouter } from "./router/system";

export const orpcRouter = {
  opportunities: opportunitiesRouter,
  system: systemRouter,
};

export type OrpcRouter = typeof orpcRouter;
