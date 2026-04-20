import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ProviderSlug } from "@repo/app-providers";
import { getProvider } from "@repo/app-providers";
import type { LoadedFixture } from "../types";
import { getSandboxProvider } from "./providers";

const FIXTURES_DIR = join(
  import.meta.dirname,
  "../../../webhook-schemas/fixtures"
);

function assertProvider(slug: string): ProviderSlug {
  const provider = getProvider(slug);
  if (!provider) {
    throw new Error(`Unknown provider "${slug}" in fixture reference`);
  }
  return slug as ProviderSlug;
}

function resolveFixturePath(fixtureRef: string): string {
  return join(FIXTURES_DIR, fixtureRef);
}

export function loadFixture(fixtureRef: string): LoadedFixture {
  const [providerPart] = fixtureRef.split("/", 1);
  if (!providerPart) {
    throw new Error(`Invalid fixture reference "${fixtureRef}"`);
  }

  const provider = assertProvider(providerPart);
  const fixturePath = resolveFixturePath(fixtureRef);
  const raw = readFileSync(fixturePath, "utf8");
  const payload = JSON.parse(raw) as Record<string, unknown>;

  return {
    provider,
    fixtureRef,
    fixturePath,
    payload,
    eventKey: basename(fixtureRef, ".json"),
  };
}

export function deriveResourceIdFromFixture(fixture: LoadedFixture): string {
  const provider = getProvider(fixture.provider);
  if (!provider || provider.kind !== "webhook") {
    throw new Error(
      `Provider "${fixture.provider}" does not expose a webhook resource extractor`
    );
  }

  const resourceId = provider.webhook.extractResourceId(fixture.payload);
  if (!resourceId) {
    throw new Error(
      `Fixture "${fixture.fixtureRef}" did not resolve a provider resource ID`
    );
  }

  return resourceId;
}

export function overrideFixtureResourceId(
  fixture: LoadedFixture,
  resourceId: string
): LoadedFixture {
  return getSandboxProvider(fixture.provider).overrideResourceId(
    fixture,
    resourceId
  );
}
