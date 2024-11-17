import { NetworkEditorContext } from "../state/context";

export const useGetTextureData = () => {
  const textures = NetworkEditorContext.useSelector(
    (state) => state.context.textures,
  );

  const rtargets = NetworkEditorContext.useSelector(
    (state) => state.context.rtargets,
  );

  return {
    textures,
    rtargets,
  };
};
