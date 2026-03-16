/**
 * Stub for @repo/gateway-service-clients in integration tests.
 *
 * The backfill /cancel route calls createGatewayClient().getConnection() to
 * verify the installation before firing the Inngest cancel event. In integration
 * tests the gateway isn't reachable over HTTP, so this stub always reports
 * "connection found" so the cancel flow can proceed to fire the Inngest event.
 */

export function createGatewayClient(_config: unknown) {
  return {
    getConnection(_installationId: string) {
      return Promise.resolve({ id: _installationId, status: "active" });
    },
    executeEndpoint(_installationId: string, _body: unknown) {
      return Promise.resolve({ status: 200, data: {} });
    },
    getToken(_installationId: string) {
      return Promise.resolve({
        token: "stub-token",
        tokenType: "Bearer",
        expiresAt: null,
      });
    },
    cancelBackfill(_installationId: string) {
      return Promise.resolve({ status: "cancelled" });
    },
  };
}
