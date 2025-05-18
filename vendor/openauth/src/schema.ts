import { z } from "zod";

export const $SessionType = z.enum(["user", "server"]);

export type SessionType = z.infer<typeof $SessionType>;

export const $UserSession = z.object({
  type: z.literal($SessionType.Enum.user),
  user: z.object({
    email: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
  }),
});

export type UserSession = z.infer<typeof $UserSession>;

export const $ServerSession = z.object({
  type: z.literal($SessionType.Enum.server),
});

export const $Session = z.discriminatedUnion("type", [
  $UserSession,
  $ServerSession,
]);

export type Session = z.infer<typeof $Session>;
