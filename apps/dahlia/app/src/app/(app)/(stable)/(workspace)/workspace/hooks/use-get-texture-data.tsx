import { useTextureRenderStore } from "../providers/texture-render-store-provider";

export const useGetTextureData = () => {
  const { targets } = useTextureRenderStore((state) => state);
  return { targets };
};
