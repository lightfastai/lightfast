import { api } from "~/trpc/react";
import { NetworkEditorContext } from "../../state/context";

interface UseWorkspaceAddNodeProps {
  workspaceId: string;
  utils: ReturnType<typeof api.useUtils>;
}

export const useWorkspaceAddNode = ({
  workspaceId,
  utils,
}: UseWorkspaceAddNodeProps) => {
  const state = NetworkEditorContext.useSelector((state) => state);
  const addNode = api.node.create.useMutation({
    onSuccess: () => {
      utils.node.getAllNodeIds.invalidate({ workspaceId });
    },
  });

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (state.context.selectedGeometry) {
      addNode.mutate({
        workspaceId,
        type: "geometry",
        position: { x: event.clientX, y: event.clientY },
        data: {
          type: state.context.selectedGeometry,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
      });
    } else if (state.context.selectedMaterial) {
      addNode.mutate({
        workspaceId,
        type: "material",
        position: { x: event.clientX, y: event.clientY },
        data: {
          type: state.context.selectedMaterial,
          color: "#ffffff",
          shouldRenderInNode: true,
        },
      });
    }
  };

  return { handleCanvasClick };
};
