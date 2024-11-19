"use client";

import { ReactFlowProvider } from "@xyflow/react";

import { EditorHeaderFile } from "./components/app/editor-header-file";
import { EditorHeaderHelpers } from "./components/app/editor-header-helpers";
import { NetworkEditorContext } from "./state/context";

export default function NetworkEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NetworkEditorContext.Provider>
      <ReactFlowProvider>
        <EditorHeaderFile />
        <EditorHeaderHelpers />
        {children}
      </ReactFlowProvider>
    </NetworkEditorContext.Provider>
  );
}
