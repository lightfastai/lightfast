import { z } from "zod";

export const $Txt2ImgModel = z.enum(["flux/dev", "flux/schnell"]);

export type Txt2ImgModel = z.infer<typeof $Txt2ImgModel>;
