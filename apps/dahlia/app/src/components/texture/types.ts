import type { z } from "zod";

import type { $Texture, $TextureTypes } from "./schema";

export type Texture = z.infer<typeof $Texture>;

export type TextureType = z.infer<typeof $TextureTypes>;
