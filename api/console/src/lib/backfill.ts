/**
 * Notify the relay to trigger a historical backfill for a connection.
 * Best-effort — errors are logged but never thrown.
 *
 * TODO: Wire up when backfill service is ready for production.
 */
export async function notifyBackfill(_params: {
  installationId: string;
  provider: string;
  orgId: string;
  depth?: 7 | 30 | 90;
  entityTypes?: string[];
  holdForReplay?: boolean;
  correlationId?: string;
}): Promise<void> {
  return;
}
