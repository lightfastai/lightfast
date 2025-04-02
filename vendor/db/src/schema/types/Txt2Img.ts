import { z } from "zod";

import { $Txt2ImgModel } from "@repo/ai/schema";

export const $Txt2ImgType = z.enum([
  $Txt2ImgModel.Enum["flux/dev"],
  $Txt2ImgModel.Enum["flux/schnell"],
]);

export type Txt2ImgType = z.infer<typeof $Txt2ImgType>;

export const $Txt2Img = z.object({
  type: $Txt2ImgType,
  prompt: z.string(),
  image_url: z.string().url().optional(),
});

export type Txt2Img = z.infer<typeof $Txt2Img>;

interface CreateDefaultTxt2ImgOptions {
  type: Txt2ImgType;
  prompt?: string;
}

export const createDefaultTxt2Img = ({
  type,
  prompt = "",
}: CreateDefaultTxt2ImgOptions): Txt2Img =>
  ({
    type,
    prompt,
  }) satisfies Txt2Img;
