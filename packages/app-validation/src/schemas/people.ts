import { z } from "zod";

// Shared by AI people extraction and DB persistence; keep provider/type
// vocabulary centralized so the classifier cannot emit values the DB rejects.
export const peopleIdentityProviderSchema = z.enum([
  "email",
  "x",
  "linkedin",
  "github",
  "website",
]);

export const peopleIdentityTypeSchema = z.enum([
  "email",
  "handle",
  "profile_url",
]);

export const personSourceSchema = z.enum([
  "signal",
  "team_member",
  "mixed",
  "entity_graph",
]);

export const personMemberStatusSchema = z.enum(["active", "former"]);

export type PersonIdentityProvider = z.infer<
  typeof peopleIdentityProviderSchema
>;
export type PersonIdentityType = z.infer<typeof peopleIdentityTypeSchema>;
export type PersonSource = z.infer<typeof personSourceSchema>;
export type PersonMemberStatus = z.infer<typeof personMemberStatusSchema>;
