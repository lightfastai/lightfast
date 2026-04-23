import { createHmac, randomUUID } from "node:crypto";
import type { LoadedFixture, ReplayRequest } from "../../types";
import { requireEnv } from "../signing";
import type { SandboxProvider } from "./types";

const SIGNING_SECRET_ENV = "VERCEL_CLIENT_INTEGRATION_SECRET";

export const vercel: SandboxProvider = {
  requiredEnvVars: [SIGNING_SECRET_ENV],

  deriveInboundEventType(fixture: LoadedFixture): string {
    const type = fixture.payload.type;
    return typeof type === "string" ? type : fixture.eventKey;
  },

  overrideResourceId(
    fixture: LoadedFixture,
    resourceId: string
  ): LoadedFixture {
    const payload = structuredClone(fixture.payload) as Record<string, unknown>;
    const innerPayload = payload.payload;
    if (
      !innerPayload ||
      typeof innerPayload !== "object" ||
      !("project" in innerPayload)
    ) {
      throw new Error(
        `Fixture "${fixture.fixtureRef}" is missing payload.project for override`
      );
    }
    const project = (innerPayload as { project?: Record<string, unknown> })
      .project;
    if (!project || typeof project !== "object") {
      throw new Error(
        `Fixture "${fixture.fixtureRef}" is missing payload.project for override`
      );
    }
    project.id = resourceId;
    return { ...fixture, payload };
  },

  buildSignedRequest(fixture: LoadedFixture): ReplayRequest {
    const body = JSON.stringify(fixture.payload);
    const inboundEventType = this.deriveInboundEventType(fixture);
    const payloadId = fixture.payload.id;
    const deliveryId =
      typeof payloadId === "string" && payloadId.length > 0
        ? payloadId
        : `lf-e2e-${randomUUID()}`;
    const signature = createHmac("sha1", requireEnv(SIGNING_SECRET_ENV))
      .update(body)
      .digest("hex");

    return {
      body,
      deliveryId,
      inboundEventType,
      headers: {
        "content-type": "application/json",
        "x-vercel-signature": signature,
      },
    };
  },
};
