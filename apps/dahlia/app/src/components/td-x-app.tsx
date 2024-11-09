"use client";

import { TDxMachineContext } from "~/machine/context";
import TDxCanvas from "./td-x-canvas";
import { TDxCommandDialog } from "./td-x-command-dialog";

export const TDxApp = () => {
  return (
    <TDxMachineContext.Provider>
      <TDxCanvas />
      <TDxCommandDialog />
    </TDxMachineContext.Provider>
  );
};
