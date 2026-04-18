import { z } from "zod";

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, {
    message: "name must be lowercase kebab-case",
  }),
  description: z.string().min(1).max(500),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
