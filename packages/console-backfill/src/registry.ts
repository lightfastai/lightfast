import type { SourceType } from "@repo/console-providers";
import type { BackfillConnector } from "./types.js";

const connectors = new Map<SourceType, BackfillConnector>();

export function registerConnector(connector: BackfillConnector): void {
  connectors.set(connector.provider, connector);
}

export function getConnector(provider: SourceType): BackfillConnector | undefined {
  return connectors.get(provider);
}

export function hasConnector(provider: SourceType): boolean {
  return connectors.has(provider);
}

/** @internal Test-only — resets the registry. */
export function clearRegistry(): void {
  connectors.clear();
}
