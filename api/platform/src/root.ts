/**
 * Platform service root router.
 *
 * Two top-level routers:
 * - platformRouter: Service-accessible procedures (store, retrieve, search)
 * - adminRouter: Admin-only procedures (reindex, purge, diagnostics)
 */
import { backfillRouter } from "./router/platform/backfill";
import { connectionsRouter } from "./router/platform/connections";
import { proxyRouter } from "./router/platform/proxy";
import { createTRPCRouter } from "./trpc";

/**
 * Platform router -- service-accessible procedures.
 * Accessible via /api/trpc/platform/*
 *
 * Sub-routers:
 * - connections.*: Connection lifecycle operations
 * - proxy.*: Authenticated API proxy operations
 * - backfill.*: Backfill orchestration operations
 * - ingest.*: Webhook ingestion operations (future)
 * - pipeline.*: Neural pipeline operations (future)
 */
export const platformRouter = createTRPCRouter({
  connections: connectionsRouter,
  proxy: proxyRouter,
  backfill: backfillRouter,
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
export type PlatformRouter = typeof platformRouter;
export type AdminRouter = typeof adminRouter;
