import { z } from "zod";

export const earlyAccessFormSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export type EarlyAccessFormSchema = z.infer<typeof earlyAccessFormSchema>;
