import { z } from "zod";

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

export const peopleCandidateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  identityProvider: peopleIdentityProviderSchema,
  identityType: peopleIdentityTypeSchema,
  identityValue: z.string().trim().min(1).max(2000),
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

export const peopleClassificationSchema = z.object({
  schemaVersion: z.literal("people.classification.v1"),
  candidates: z.array(peopleCandidateSchema).max(10),
});

export const peopleClassificationModelSchema = peopleClassificationSchema.omit({
  schemaVersion: true,
});

export type PeopleIdentityProvider = z.infer<
  typeof peopleIdentityProviderSchema
>;
export type PeopleIdentityType = z.infer<typeof peopleIdentityTypeSchema>;
export type PeopleCandidate = z.infer<typeof peopleCandidateSchema>;
export type PeopleClassification = z.infer<typeof peopleClassificationSchema>;
