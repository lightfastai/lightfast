"use client";

import { EditorHeader } from "./components/app/editor-header";
import { NetworkEditorContext } from "./state/context";

export default function NetworkEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NetworkEditorContext.Provider>
      <div className="fixed inset-0 flex flex-col pl-[3rem]">
        <EditorHeader />
        {children}
      </div>
    </NetworkEditorContext.Provider>
  );
}
