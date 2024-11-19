"use client";

import { useInspectProperty } from "../../hooks/use-inspect-property";
import { PropertyInspectorTexture } from "./property-inspector-texture";

export const PropertyInspector = () => {
  const { selectedProperty } = useInspectProperty();

  if (!selectedProperty) return null;

  return (
    <div className="absolute right-4 top-4 w-96 rounded-lg border bg-background shadow-md">
      <PropertyInspectorTexture />
    </div>
  );
};
