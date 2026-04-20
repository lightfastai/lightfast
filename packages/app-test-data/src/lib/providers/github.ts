import { createHmac, randomUUID } from "node:crypto";
import type { LoadedFixture, ReplayRequest } from "../../types";
import { requireEnv } from "../signing";
import type { SandboxProvider } from "./types";

const SIGNING_SECRET_ENV = "GITHUB_WEBHOOK_SECRET";

export const github: SandboxProvider = {
  requiredEnvVars: [SIGNING_SECRET_ENV],

  deriveInboundEventType(fixture: LoadedFixture): string {
    return fixture.eventKey.split(".")[0] ?? fixture.eventKey;
  },

  overrideResourceId(
    fixture: LoadedFixture,
    resourceId: string
  ): LoadedFixture {
    const payload = structuredClone(fixture.payload) as Record<string, unknown>;
    const repository = payload.repository;
    if (!repository || typeof repository !== "object") {
      throw new Error(
        `Fixture "${fixture.fixtureRef}" is missing payload.repository for override`
      );
    }
    const numericId = Number.parseInt(resourceId, 10);
    if (!Number.isFinite(numericId)) {
      throw new Error(
        `GitHub resource override "${resourceId}" must be a numeric repository ID`
      );
    }
    (repository as { id: number }).id = numericId;
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
        "x-github-delivery": deliveryId,
        "x-github-event": inboundEventType,
        "x-hub-signature-256": `sha256=${signature}`,
      },
    };
  },
};
