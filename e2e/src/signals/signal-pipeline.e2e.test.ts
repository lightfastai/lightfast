import { createHash } from "node:crypto";
import { getPersonByIdentityKey, type Person } from "@db/app";
import { db } from "@db/app/client";
import {
  createSignalOutput,
  getSignalOutput,
  systemHealthOutput,
} from "@repo/api-contract";
import { describe, expect, it } from "vitest";

import {
  allowLocalhostTls,
  readPositiveInteger,
  resolveE2EApiKey,
  resolveE2EClerkOrgId,
  shouldCheckAppHealth,
} from "../helpers/env";
import { fetchJson } from "../helpers/fetch-json";
import {
  resolveE2EApiBase,
  resolveE2EAppUrl,
} from "../helpers/resolve-app-url";

describe("signal pipeline E2E smoke", () => {
  it(
    "creates a signal through public HTTP and persists routed people",
    async () => {
      const appUrl = resolveE2EAppUrl();
      const apiBase = resolveE2EApiBase();
      const apiKey = resolveE2EApiKey();
      const clerkOrgId = resolveE2EClerkOrgId();
      const socialHandle = resolveE2ESocialHandle();
      const input =
        process.env.LIGHTFAST_SIGNAL_INPUT ??
        [
          "Signal pipeline smoke: identify this durable social person for follow-up.",
          `Person: Lightfast E2E ${socialHandle}.`,
          `X profile: https://x.com/${socialHandle}.`,
          "The organization should add this profile to People after classification.",
        ].join(" ");
      const timeoutMs = readPositiveInteger(
        "LIGHTFAST_SIGNAL_TIMEOUT_MS",
        120_000
      );
      const pollMs = readPositiveInteger("LIGHTFAST_SIGNAL_POLL_MS", 2500);

      allowLocalhostTls(appUrl);
      allowLocalhostTls(apiBase);

      const headers = {
        Authorization: `Bearer ${apiKey}`,
      };

      if (shouldCheckAppHealth()) {
        const appHealth = await fetchJson(appUrl, "/api/health", {}, 200);
        expect(appHealth).toEqual(
          expect.objectContaining({
            service: "app",
            status: "ok",
          })
        );
      }

      const apiHealth = systemHealthOutput.parse(
        await fetchJson(apiBase, "/system/health", { headers }, 200)
      );
      expect(apiHealth.status).toBe("ok");

      const created = createSignalOutput.parse(
        await fetchJson(
          apiBase,
          "/signals",
          {
            body: JSON.stringify({ input }),
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            method: "POST",
          },
          202
        )
      );

      const signal = await waitForClassifiedSignal({
        apiBase,
        headers,
        input,
        pollMs,
        signalId: created.id,
        timeoutMs,
      });

      expect(signal.status).toBe("classified");
      const classification = signal.classification;
      expect(classification).not.toBeNull();
      if (!classification) {
        throw new Error(`Signal ${created.id} classified without output.`);
      }
      expect(classification).toEqual(
        expect.objectContaining({
          confidence: expect.any(Number),
          schemaVersion: "signal.classification.v1",
          title: expect.any(String),
        })
      );
      expect(classification.routing?.classifyPeople?.shouldRun).toBe(true);

      const person = await waitForPerson({
        clerkOrgId,
        pollMs,
        signalId: created.id,
        socialHandle,
        timeoutMs,
      });

      expect(person.identityProvider).toBe("x");
      expect(person.identityType).toBe("handle");
      expect(person.normalizedIdentityValue).toBe(socialHandle);
      expect(person.lastSeenSignalId).toBe(created.id);
      expect(person.metadata).toEqual(
        expect.objectContaining({
          source: "people.classification.v1",
        })
      );
    },
    readPositiveInteger("LIGHTFAST_SIGNAL_TIMEOUT_MS", 120_000) + 10_000
  );
});

interface WaitForClassifiedSignalInput {
  apiBase: string;
  headers: Record<string, string>;
  input: string;
  pollMs: number;
  signalId: string;
  timeoutMs: number;
}

interface WaitForPersonInput {
  clerkOrgId: string;
  pollMs: number;
  signalId: string;
  socialHandle: string;
  timeoutMs: number;
}

async function waitForClassifiedSignal({
  apiBase,
  headers,
  input,
  pollMs,
  signalId,
  timeoutMs,
}: WaitForClassifiedSignalInput) {
  const startedAt = Date.now();
  let lastSignal: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    lastSignal = await fetchJson(
      apiBase,
      `/signals/${encodeURIComponent(signalId)}`,
      { headers },
      200
    );
    const signal = getSignalOutput.parse(lastSignal);

    expect(signal.id).toBe(signalId);
    expect(signal.input).toBe(input);

    if (signal.status === "classified") {
      expect(signal.classification).not.toBeNull();
      return signal;
    }

    if (signal.status === "failed") {
      throw new Error(
        `Signal ${signalId} failed before classification completed. Last response: ${JSON.stringify(signal)}`
      );
    }

    await sleep(pollMs);
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for signal ${signalId} to classify. Last response: ${JSON.stringify(lastSignal)}`
  );
}

async function waitForPerson({
  clerkOrgId,
  pollMs,
  signalId,
  socialHandle,
  timeoutMs,
}: WaitForPersonInput) {
  const startedAt = Date.now();
  const identityKey = createXHandleIdentityKey(socialHandle);
  let lastPerson: Person | undefined;

  while (Date.now() - startedAt < timeoutMs) {
    lastPerson = await getPersonByIdentityKey(db, {
      clerkOrgId,
      identityKey,
    });

    if (lastPerson?.lastSeenSignalId === signalId) {
      return lastPerson;
    }

    await sleep(pollMs);
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for people row ${socialHandle} from signal ${signalId}. Last row: ${JSON.stringify(lastPerson)}`
  );
}

function createXHandleIdentityKey(handle: string): string {
  return createHash("sha256")
    .update(["x", "handle", handle].join("\0"))
    .digest("hex");
}

function resolveE2ESocialHandle(): string {
  const value = process.env.LIGHTFAST_E2E_SOCIAL_HANDLE?.trim();
  if (value) {
    return value.replace(/^@/, "").toLowerCase();
  }

  return `lightfast_e2e_${Date.now().toString(36)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
