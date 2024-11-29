import { z } from "zod";

export const $Txt2ImgModel = z.enum(["flux/dev", "flux/schnell"]);

export type Txt2ImgModel = z.infer<typeof $Txt2ImgModel>;

export const $FluxDevInput = z.object({
  prompt: z.string(),
  image_size: z.enum([
    "square_hd",
    "square",
    "portrait_4_3",
    "portrait_16_9",
    "landscape_4_3",
    "landscape_16_9",
  ]),
  num_inference_steps: z.number().default(28),
  seed: z.number().default(42),
  guidance_scale: z.number().default(3.5),
  sync_mode: z.boolean().default(false),
  num_images: z.number().default(1),
  enable_safety_checker: z.boolean().default(true),
});

export type FluxDevInput = z.infer<typeof $FluxDevInput>;

export const $FluxDevOutput = z.object({
  images: z.array(z.string().url()),
  seed: z.number(),
  has_nfsw_concepts: z.boolean(),
  prompt: z.string(),
});

export type FluxDevOutput = z.infer<typeof $FluxDevOutput>;
