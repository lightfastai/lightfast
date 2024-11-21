"use client";

import { memo } from "react";
import { ReactFlowProvider } from "@xyflow/react";

import { NetworkEditorContext } from "../../state/context";

const WorkspaceProviderComponent = ({
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

export const WorkspaceProvider = memo(WorkspaceProviderComponent);
