import { fal } from "@fal-ai/client";

import { env } from "~/env";
import { Txt2ImgModel } from "../schema/txt2img";

fal.config({
  credentials: env.FAL_API_KEY,
});

const falModelName = (model: Txt2ImgModel) => "fal-ai/" + model;

export const subscribe = async (model: Txt2ImgModel, prompt: string) => {
  const subscription = await fal.subscribe(falModelName(model), {
    input: {
      prompt,
    },
  });
  return subscription;
};
