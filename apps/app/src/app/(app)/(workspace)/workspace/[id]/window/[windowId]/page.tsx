import { notFound } from "next/navigation";

import { GeometryMap } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-globals";
import { WebGLView } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-primitives";
import { $GeometryType } from "~/db/schema/types";
import { api } from "~/trpc/client/server";

interface WindowPageProps {
  params: {
    id: string;
    windowId: string;
  };
}

export default async function WindowPage({ params }: WindowPageProps) {
  const windowNode = await api.tenant.node.data.get({ id: params.windowId });

  if (!windowNode) {
    notFound();
  }

  return (
    <div className="h-screen w-screen bg-background">
      <WebGLView>
        <mesh geometry={GeometryMap[$GeometryType.Enum.plane]}>
          <meshBasicMaterial map={windowNode.texture} />
        </mesh>
      </WebGLView>
    </div>
  );
}
