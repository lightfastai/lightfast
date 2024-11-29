import { fal } from "@fal-ai/client";

import { env } from "~/env";
import { Txt2ImgModel } from "../schema/txt2img";

fal.config({
  credentials: env.FAL_API_KEY,
});

const falModelName = (model: Txt2ImgModel) => "fal-ai/" + model;

export const subscribe = async (model: Txt2ImgModel, prompt: string) => {
  try {
    const subscription = await fal.subscribe(falModelName(model), {
      input: {
        prompt,
      },
    });
    return subscription;
  } catch (error) {
    console.error(error);
    // error happens because the model is not available/found
    if (error instanceof Error && error.message.includes("404")) {
      // do something
    }
    // do something else
  }
};
