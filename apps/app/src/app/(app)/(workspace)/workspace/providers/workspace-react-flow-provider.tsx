"use client";

import { ReactFlowProvider } from "@xyflow/react";

export const WorkspaceReactFlowProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
};
