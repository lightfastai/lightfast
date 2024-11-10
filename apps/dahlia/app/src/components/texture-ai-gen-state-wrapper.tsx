"use client";

import { TDxMachineContext } from "~/machine/context";
import { TextureAIGenerator } from "./texture-ai-gen";

export const TextureAIGeneratorStateWrapper = () => {
  return (
    <TDxMachineContext.Provider>
      <TextureAIGenerator />
    </TDxMachineContext.Provider>
  );
};
