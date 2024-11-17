import { createActorContext } from "@xstate/react";

import { canvasMachine } from "./state";

export const NetworkEditorContext = createActorContext(canvasMachine);
