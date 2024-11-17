"use client";

import { TDxMachineContext } from "~/machine/context";
import { EditorCommandDialog } from "../app/(app)/(stable)/(network-editor)/components/app/editor-command-dialog";
import TDxCanvas from "./td-x-canvas";

export const TDxApp = () => {
  return (
    <TDxMachineContext.Provider>
      <TDxCanvas />
      <EditorCommandDialog />
    </TDxMachineContext.Provider>
  );
};
