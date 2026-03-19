/**
 * Memory service root router.
 *
 * Two top-level routers:
 * - memoryRouter: Service-accessible procedures (store, retrieve, search)
 * - adminRouter: Admin-only procedures (reindex, purge, diagnostics)
 */
import { connectionsRouter } from "./router/memory/connections";
import { proxyRouter } from "./router/memory/proxy";
import { createTRPCRouter } from "./trpc";

/**
 * Memory router -- service-accessible procedures.
 * Accessible via /api/trpc/memory/*
 *
 * Sub-routers:
 * - connections.*: Connection lifecycle operations
 * - proxy.*: Authenticated API proxy operations
 * - ingest.*: Webhook ingestion operations (future)
 * - pipeline.*: Neural pipeline operations (future)
 */
export const memoryRouter = createTRPCRouter({
  connections: connectionsRouter,
  proxy: proxyRouter,
});

/**
 * Admin router -- restricted to admin callers.
 * Accessible via /api/trpc/admin/*
 *
 * Sub-routers will be added as features are implemented:
 * - reindex.*: Re-embed and reindex operations
 * - diagnostics.*: Health and status checks
 */
export const adminRouter = createTRPCRouter({
  // Empty initially -- sub-routers added in later phases
});

// Export types for client usage
export type MemoryRouter = typeof memoryRouter;
export type AdminRouter = typeof adminRouter;
