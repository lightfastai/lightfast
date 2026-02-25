/**
 * Fixture-based provider tests using real webhook payloads from @repo/console-test-data.
 *
 * Runs every webhook from every sandbox dataset through the gateway's provider
 * pipeline: parsePayload → extractEventType → extractResourceId.
 *
 * Catches regressions where a real provider payload shape breaks extraction
 * logic that synthetic unit tests wouldn't surface.
 */
import { describe, it, expect } from "vitest";
import { loadAllRawWebhooks, type RawWebhook } from "@repo/console-test-data/raw";
import { getProvider } from "./index";
import type { ProviderName } from "./types";

// ── Load all sandbox datasets ──

const allWebhooks: RawWebhook[] = loadAllRawWebhooks();

// ── Expected extraction rules per provider ──

const extractionExpectations: Record<
  ProviderName,
  {
    resourceIdField: string;
    expectResourceId: (payload: Record<string, unknown>) => string | null;
  }
> = {
  github: {
    resourceIdField: "repository.id or installation.id",
    expectResourceId: (p) => {
      const repo = (p.repository as Record<string, unknown>)?.id;
      if (repo != null) return String(repo);
      const inst = (p.installation as Record<string, unknown>)?.id;
      if (inst != null) return String(inst);
      return null;
    },
  },
  vercel: {
    resourceIdField: "payload.project.id or payload.team.id",
    expectResourceId: (p) => {
      const payload = p.payload as Record<string, unknown> | undefined;
      const project = (payload?.project as Record<string, unknown>)?.id;
      if (project != null) return String(project);
      const team = (payload?.team as Record<string, unknown>)?.id;
      if (team != null) return String(team);
      return null;
    },
  },
  linear: {
    resourceIdField: "organizationId",
    expectResourceId: (p) => (p.organizationId as string) ?? null,
  },
  sentry: {
    resourceIdField: "installation.uuid",
    expectResourceId: (p) =>
      ((p.installation as Record<string, unknown>)?.uuid as string) ?? null,
  },
};

// ── Tests ──

describe("fixture-based provider extraction (real webhook payloads)", () => {
  for (const providerName of ["github", "vercel", "linear", "sentry"] as const) {
    const providerWebhooks = allWebhooks.filter(
      (wh) => wh.source === providerName,
    );

    describe(providerName, () => {
      const provider = getProvider(providerName);

      it(`parsePayload succeeds for all ${providerWebhooks.length} real payloads`, () => {
        for (const wh of providerWebhooks) {
          expect(() => provider.parsePayload(wh.payload)).not.toThrow();
        }
      });

      it("extractResourceId returns expected value for all payloads", () => {
        const expectations = extractionExpectations[providerName];
        for (const wh of providerWebhooks) {
          const parsed = provider.parsePayload(wh.payload);
          const actual = provider.extractResourceId(parsed);
          const expected = expectations.expectResourceId(wh.payload);
          expect(actual).toBe(expected);
        }
      });

      it("extractEventType returns non-empty string for all payloads", () => {
        const headers = new Headers();
        for (const wh of providerWebhooks) {
          const parsed = provider.parsePayload(wh.payload);
          const eventType = provider.extractEventType(headers, parsed);
          expect(eventType).toBeTruthy();
        }
      });

      it("extractDeliveryId returns a string for all payloads", () => {
        const headers = new Headers();
        for (const wh of providerWebhooks) {
          const parsed = provider.parsePayload(wh.payload);
          const deliveryId = provider.extractDeliveryId(headers, parsed);
          expect(typeof deliveryId).toBe("string");
          expect(deliveryId.length).toBeGreaterThan(0);
        }
      });
    });
  }

  it("covers all 4 providers in fixture data", () => {
    const providers = new Set(allWebhooks.map((wh) => wh.source));
    expect(providers).toEqual(new Set(["github", "vercel", "linear", "sentry"]));
  });

  it(`loaded ${allWebhooks.length} total webhook fixtures`, () => {
    expect(allWebhooks.length).toBeGreaterThan(100);
  });
});
