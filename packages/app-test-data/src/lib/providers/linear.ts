import { createHmac, randomUUID } from "node:crypto";
import type { LoadedFixture, ReplayRequest } from "../../types";
import { requireEnv } from "../signing";
import type { SandboxProvider } from "./types";

const SIGNING_SECRET_ENV = "LINEAR_WEBHOOK_SIGNING_SECRET";

export const linear: SandboxProvider = {
  requiredEnvVars: [SIGNING_SECRET_ENV],

  deriveInboundEventType(fixture: LoadedFixture): string {
    const type = fixture.payload.type;
    return typeof type === "string"
      ? type
      : (fixture.eventKey.split(".")[0] ?? fixture.eventKey);
  },

  overrideResourceId(
    fixture: LoadedFixture,
    resourceId: string
  ): LoadedFixture {
    const payload = structuredClone(fixture.payload) as Record<string, unknown>;
    payload.organizationId = resourceId;
    return { ...fixture, payload };
  },

  buildSignedRequest(fixture: LoadedFixture): ReplayRequest {
    const body = JSON.stringify(fixture.payload);
    const inboundEventType = this.deriveInboundEventType(fixture);
    const deliveryId = `lf-e2e-${randomUUID()}`;
    const signature = createHmac("sha256", requireEnv(SIGNING_SECRET_ENV))
      .update(body)
      .digest("hex");

    return {
      body,
      deliveryId,
      inboundEventType,
      headers: {
        "content-type": "application/json",
        "linear-delivery": deliveryId,
        "linear-signature": signature,
      },
    };
  },
};
