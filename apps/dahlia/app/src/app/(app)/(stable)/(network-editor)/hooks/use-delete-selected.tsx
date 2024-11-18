import { useCallback } from "react";

import { NetworkEditorContext } from "../state/context";

export const useDeleteSelected = () => {
  const machineRef = NetworkEditorContext.useActorRef();

  const handleDeleteSelectedNodes = useCallback(() => {
    machineRef.send({ type: "DELETE_SELECTED_NODES" });
  }, []);

  return { handleDeleteSelectedNodes };
};
