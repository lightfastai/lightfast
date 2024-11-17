"use client";

import { NetworkEditorContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { EditorCommandDialog } from "../app/(app)/(stable)/(network-editor)/components/app/editor-command-dialog";
import TDxCanvas from "./td-x-canvas";

export const TDxApp = () => {
  return (
    <NetworkEditorContext.Provider>
      <TDxCanvas />
      <EditorCommandDialog />
    </NetworkEditorContext.Provider>
  );
};
