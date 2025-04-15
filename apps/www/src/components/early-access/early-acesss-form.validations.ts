import { z } from "zod";

export const earlyAcessFormSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});
