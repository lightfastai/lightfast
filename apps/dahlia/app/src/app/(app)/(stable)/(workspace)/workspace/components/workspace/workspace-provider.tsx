"use client";

import { ReactFlowProvider } from "@xyflow/react";

import { NetworkEditorContext } from "../../state/context";

export const WorkspaceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <ReactFlowProvider>
      <NetworkEditorContext.Provider>{children}</NetworkEditorContext.Provider>
    </ReactFlowProvider>
  );
};
