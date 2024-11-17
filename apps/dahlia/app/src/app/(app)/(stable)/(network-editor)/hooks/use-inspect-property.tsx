import { NetworkEditorContext } from "../state/context";

export const useInspectProperty = () => {
  const machineRef = NetworkEditorContext.useActorRef();

  const selectedProperty = NetworkEditorContext.useSelector(
    (state) => state.context.selectedProperty,
  );

  return { selectedProperty };
};
