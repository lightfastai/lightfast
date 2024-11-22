"use client";

import { ReactFlowProvider } from "@xyflow/react";

export const WorkspaceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
};
