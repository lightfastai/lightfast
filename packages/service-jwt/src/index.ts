import { jwtVerify, SignJWT } from "@vendor/jose";
import { z } from "zod";

export const SERVICE_JWT_CALLERS = ["app", "inngest", "cron", "mcp"] as const;
export const SERVICE_JWT_AUDIENCES = ["lightfast-app"] as const;

export type ServiceJwtCaller = (typeof SERVICE_JWT_CALLERS)[number];
export type ServiceJwtAudience = (typeof SERVICE_JWT_AUDIENCES)[number];

export type ServiceJwtErrorCode = "invalid_token" | "disallowed_caller";

export class ServiceJwtError extends Error {
  constructor(
    readonly code: ServiceJwtErrorCode,
    message: string,
    readonly status: 401 | 403,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ServiceJwtError";
  }
}

const serviceJwtPayloadSchema = z
  .object({
    iss: z.enum(SERVICE_JWT_CALLERS),
    token_use: z.literal("service_access"),
  })
  .passthrough();

function secretKey(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

export async function signServiceJWT(input: {
  audience: ServiceJwtAudience;
  caller: ServiceJwtCaller;
  jwtSecret: string;
  ttlSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = input.ttlSeconds ?? 60;

  return await new SignJWT({ token_use: "service_access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(input.caller)
    .setAudience(input.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(secretKey(input.jwtSecret));
}

export async function verifyServiceJWT(input: {
  allowedCallers?: readonly ServiceJwtCaller[];
  audience: ServiceJwtAudience;
  jwtSecret: string;
  token: string;
}): Promise<{ audience: ServiceJwtAudience; caller: ServiceJwtCaller }> {
  try {
    const { payload } = await jwtVerify(
      input.token,
      secretKey(input.jwtSecret),
      {
        algorithms: ["HS256"],
        audience: input.audience,
      }
    );
    const parsed = serviceJwtPayloadSchema.parse(payload);
    const caller = parsed.iss;

    if (input.allowedCallers && !input.allowedCallers.includes(caller)) {
      throw new ServiceJwtError(
        "disallowed_caller",
        "Service caller is not allowed for this command.",
        403
      );
    }

    return {
      audience: input.audience,
      caller,
    };
  } catch (error) {
    if (error instanceof ServiceJwtError) {
      throw error;
    }
    throw new ServiceJwtError(
      "invalid_token",
      "Service token is invalid.",
      401,
      {
        cause: error,
      }
    );
  }
}
