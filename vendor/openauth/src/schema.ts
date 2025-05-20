import { z } from "zod";

export const $SessionType = z.enum(["user", "server"]);

export type SessionType = z.infer<typeof $SessionType>;

export const $Token = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  refreshToken: z.string().optional(),
});

export type Token = z.infer<typeof $Token>;

export type RefreshToken = z.infer<typeof $Token.shape.refreshToken>;
export type AccessToken = z.infer<typeof $Token.shape.accessToken>;

export const $TokenOrNull = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

export type TokenOrNull = z.infer<typeof $TokenOrNull>;

export const $UserSession = z.object({
  type: z.literal($SessionType.Enum.user),
  user: $Token.merge(
    z.object({
      id: z.string(),
    }),
  ),
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
