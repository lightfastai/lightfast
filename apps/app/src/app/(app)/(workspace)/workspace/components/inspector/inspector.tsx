"use client";

import type { Texture } from "@vendor/db/types";

import { api } from "~/trpc/client/react";
import { useInspectorStore } from "../../providers/inspector-store-provider";
import { FluxInspector } from "./flux-inspector";
import { InspectorTexture } from "./inspector-texture";

export const Inspector = () => {
  const { selected, isOpen } = useInspectorStore((state) => state);

  if (!selected || !isOpen) return null;
  if (selected.type === "texture") {
    return <InspectorImpl id={selected.id} />;
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

const InspectorImpl = ({ id }: { id: string }) => {
  const [data] = api.tenant.node.data.get.useSuspenseQuery<Texture>({
    nodeId: id,
  });
  return <InspectorTexture key={id} data={data} id={id} />;
};
