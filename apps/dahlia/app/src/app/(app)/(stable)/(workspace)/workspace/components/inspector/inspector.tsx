"use client";

import { useCallback, useEffect } from "react";

import { useInspectorStore } from "../../providers/inspector-store-provider";
import { InspectorTexture } from "./inspector-texture";

export const Inspector = () => {
  const { selected, setIsOpen, isOpen } = useInspectorStore((state) => state);

  const toggleInspector = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "p") {
        e.preventDefault();
        toggleInspector();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleInspector]);

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
  return null;
};
