"use client";

import { NetworkEditorContext } from "~/app/(app)/(stable)/(workspace)/workspace/state/context";
import { TextureAIGenerator } from "./texture-ai-gen";

export const TextureAIGeneratorStateWrapper = () => {
  return (
    <NetworkEditorContext.Provider>
      <TextureAIGenerator />
    </NetworkEditorContext.Provider>
  );
};
