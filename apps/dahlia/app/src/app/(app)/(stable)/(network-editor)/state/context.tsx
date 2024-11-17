import { createActorContext } from "@xstate/react";

import { canvasMachine } from "./state";

export const TDxMachineContext = createActorContext(canvasMachine);
