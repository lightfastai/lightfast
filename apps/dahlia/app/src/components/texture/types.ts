import type { z } from "zod";

import type { $Texture, $TextureTypes, $TextureV2 } from "./schema";

export type Texture = z.infer<typeof $Texture>;

export type TextureV2 = z.infer<typeof $TextureV2>;

export type TextureType = z.infer<typeof $TextureTypes>;
