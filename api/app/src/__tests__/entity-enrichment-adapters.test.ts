import { describe, expect, it } from "vitest";

import {
  githubUserPayloadToObservation,
  xUserPayloadToObservation,
} from "../services/entity-enrichment/adapters";
import { signalProfileObservationIds } from "../services/entity-enrichment/ids";

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";

describe("entity enrichment adapters", () => {
  it("maps X user payloads to entity observations", () => {
    const observedAt = new Date("2026-06-07T00:00:00.000Z");

    expect(
      xUserPayloadToObservation(
        {
          description: "Founder at Acme.",
          id: "1",
          location: "San Francisco",
          name: "Ava Chen",
          url: "https://acme.com",
          username: "Ava_AI",
        },
        observedAt
      )
    ).toEqual({
      observedAt: observedAt.toISOString(),
      profile: {
        description: "Founder at Acme.",
        id: "1",
        location: "San Francisco",
        name: "Ava Chen",
        url: "https://acme.com",
        username: "Ava_AI",
      },
      provider: "x",
    });
  });

  it("maps GitHub user payloads to entity observations", () => {
    const observedAt = new Date("2026-06-07T00:00:00.000Z");

    expect(
      githubUserPayloadToObservation(
        {
          bio: "Building agents.",
          blog: "https://acme.com",
          company: "Acme",
          email: null,
          id: 12_345,
          location: "San Francisco",
          login: "avachen",
          name: "Ava Chen",
          twitter_username: "ava_ai",
        },
        observedAt
      )
    ).toEqual({
      observedAt: observedAt.toISOString(),
      profile: {
        bio: "Building agents.",
        blog: "https://acme.com",
        company: "Acme",
        email: null,
        id: "12345",
        location: "San Francisco",
        login: "avachen",
        name: "Ava Chen",
        twitterUsername: "ava_ai",
      },
      provider: "github",
    });
  });

  it("returns null when required provider identities are missing", () => {
    const observedAt = new Date("2026-06-07T00:00:00.000Z");

    expect(xUserPayloadToObservation({ id: "1" }, observedAt)).toBeNull();
    expect(githubUserPayloadToObservation({ id: "1" }, observedAt)).toBeNull();
  });

  it("builds stable ids from normalized profile content", () => {
    const observation = xUserPayloadToObservation(
      {
        description: "Founder at Acme.",
        id: "1",
        name: "Ava Chen",
        username: "ava_ai",
      },
      new Date("2026-06-07T00:00:00.000Z")
    );
    const sameProfileLater = xUserPayloadToObservation(
      {
        description: "Founder at Acme.",
        id: "1",
        name: "Ava Chen",
        username: "ava_ai",
      },
      new Date("2026-06-08T00:00:00.000Z")
    );
    const changedProfile = xUserPayloadToObservation(
      {
        description: "Founder at Acme AI.",
        id: "1",
        name: "Ava Chen",
        username: "ava_ai",
      },
      new Date("2026-06-07T00:00:00.000Z")
    );

    expect(observation).not.toBeNull();
    expect(sameProfileLater).not.toBeNull();
    expect(changedProfile).not.toBeNull();

    const first = signalProfileObservationIds({
      clerkOrgId: "org_test",
      observations: [observation!],
      signalId,
    });
    const retry = signalProfileObservationIds({
      clerkOrgId: "org_test",
      observations: [sameProfileLater!],
      signalId,
    });
    const changed = signalProfileObservationIds({
      clerkOrgId: "org_test",
      observations: [changedProfile!],
      signalId,
    });

    expect(retry.ingestionId).toBe(first.ingestionId);
    expect(retry.eventId).toBe(first.eventId);
    expect(changed.ingestionId).not.toBe(first.ingestionId);
    expect(first.eventId).toMatch(/^signal-entity-enrichment-org_test-/);
  });
});
