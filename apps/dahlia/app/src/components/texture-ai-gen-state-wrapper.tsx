"use client";

import { TDxMachineContext } from "~/app/(app)/(stable)/(network-editor)/state/context";
import { TextureAIGenerator } from "./texture-ai-gen";

export const TextureAIGeneratorStateWrapper = () => {
  return (
    <TDxMachineContext.Provider>
      <TextureAIGenerator />
    </TDxMachineContext.Provider>
  );
};
