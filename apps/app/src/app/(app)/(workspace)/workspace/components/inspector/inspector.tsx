"use client";

import { useWorkspaceShortcuts } from "../../hooks/use-workspace-shortcuts";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { FluxInspector } from "./flux-inspector";
import { InspectorTexture } from "./inspector-texture";

export const Inspector = () => {
  const { selected, setIsOpen, isOpen } = useInspectorStore((state) => state);

  // Only enable inspector shortcuts, disable command palette shortcuts
  useWorkspaceShortcuts({ enableCommandPalette: false });

  if (!selected || !isOpen) return null;
  if (selected.type === "texture") {
    return <InspectorTexture id={selected.id} />;
  }
  if (selected.type === "geometry") {
    return null;
  }
  if (selected.type === "material") {
    return null;
  }
  if (selected.type === "flux") {
    return <FluxInspector id={selected.id} />;
  }
  return null;
};
