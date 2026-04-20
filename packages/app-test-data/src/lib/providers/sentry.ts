import { createHmac } from "node:crypto";
import type { LoadedFixture, ReplayRequest } from "../../types";
import { requireEnv } from "../signing";
import type { SandboxProvider } from "./types";

const SIGNING_SECRET_ENV = "SENTRY_CLIENT_SECRET";

export const sentry: SandboxProvider = {
  requiredEnvVars: [SIGNING_SECRET_ENV],

  deriveInboundEventType(fixture: LoadedFixture): string {
    return fixture.eventKey;
  },

  overrideResourceId(
    fixture: LoadedFixture,
    resourceId: string
  ): LoadedFixture {
    const payload = structuredClone(fixture.payload) as Record<string, unknown>;
    const installation = payload.installation;
    if (!installation || typeof installation !== "object") {
      throw new Error(
        `Fixture "${fixture.fixtureRef}" is missing payload.installation for override`
      );
    }
    (installation as { uuid: string }).uuid = resourceId;
    return { ...fixture, payload };
  },

  buildSignedRequest(fixture: LoadedFixture): ReplayRequest {
    const body = JSON.stringify(fixture.payload);
    const inboundEventType = this.deriveInboundEventType(fixture);
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const deliveryId = `${inboundEventType}:${timestamp}`;
    const signature = createHmac("sha256", requireEnv(SIGNING_SECRET_ENV))
      .update(body)
      .digest("hex");

    return {
      body,
      deliveryId,
      inboundEventType,
      headers: {
        "content-type": "application/json",
        "sentry-hook-resource": inboundEventType,
        "sentry-hook-signature": signature,
        "sentry-hook-timestamp": timestamp,
      },
    };
  },
};
