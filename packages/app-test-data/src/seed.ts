import { db } from "@db/app/client";
import { gatewayInstallations, orgIntegrations } from "@db/app/schema";
import { getProvider } from "@repo/app-providers";
import { deriveResourceIdFromFixture, loadFixture } from "./lib/fixtures";
import type {
  LocalE2EScenario,
  ScenarioConnection,
  SeededConnection,
} from "./types";

async function seedConnection(
  scenario: LocalE2EScenario,
  connection: ScenarioConnection
): Promise<SeededConnection> {
  const provider = getProvider(connection.provider);
  if (!provider) {
    throw new Error(`Unknown provider "${connection.provider}"`);
  }

  const providerResourceId =
    connection.providerResourceId ??
    (connection.resourceIdFromFixture
      ? deriveResourceIdFromFixture(
          loadFixture(connection.resourceIdFromFixture)
        )
      : null);

  if (!providerResourceId) {
    throw new Error(
      `Connection for provider "${connection.provider}" is missing a providerResourceId`
    );
  }

  const providerConfig = provider.buildProviderConfig({
    defaultSyncEvents: connection.syncEvents ?? provider.defaultSyncEvents,
  });

  const [installation] = await db
    .insert(gatewayInstallations)
    .values({
      provider: connection.provider,
      externalId: connection.installationExternalId,
      connectedBy: scenario.clerkUserId,
      orgId: scenario.clerkOrgId,
      status: connection.installationStatus ?? "active",
    })
    .onConflictDoUpdate({
      target: [gatewayInstallations.provider, gatewayInstallations.externalId],
      set: {
        connectedBy: scenario.clerkUserId,
        orgId: scenario.clerkOrgId,
        status: connection.installationStatus ?? "active",
      },
    })
    .returning({
      id: gatewayInstallations.id,
      externalId: gatewayInstallations.externalId,
      provider: gatewayInstallations.provider,
    });

  if (!installation) {
    throw new Error(
      `Failed to seed installation for provider "${connection.provider}"`
    );
  }

  await db
    .insert(orgIntegrations)
    .values({
      clerkOrgId: scenario.clerkOrgId,
      installationId: installation.id,
      provider: connection.provider,
      providerConfig,
      providerResourceId,
      status: connection.integrationStatus ?? "active",
    })
    .onConflictDoUpdate({
      target: [
        orgIntegrations.installationId,
        orgIntegrations.providerResourceId,
      ],
      set: {
        clerkOrgId: scenario.clerkOrgId,
        provider: connection.provider,
        providerConfig,
        status: connection.integrationStatus ?? "active",
      },
    });

  return {
    installationId: installation.id,
    installationExternalId: installation.externalId,
    provider: installation.provider,
    providerResourceId,
  };
}

export async function seedScenario(
  scenario: LocalE2EScenario
): Promise<SeededConnection[]> {
  const seeded: SeededConnection[] = [];

  for (const connection of scenario.connections) {
    seeded.push(await seedConnection(scenario, connection));
  }

  return seeded;
}
