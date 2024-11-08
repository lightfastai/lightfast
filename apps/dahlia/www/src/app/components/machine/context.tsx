import { createActorContext } from "@xstate/react";

import { canvasMachine } from "./xstate";

export const TDxMachineContext = createActorContext(canvasMachine);
