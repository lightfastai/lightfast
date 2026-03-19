/**
 * Memory service root router.
 *
 * Two top-level routers:
 * - memoryRouter: Service-accessible procedures (store, retrieve, search)
 * - adminRouter: Admin-only procedures (reindex, purge, diagnostics)
 */
import { createTRPCRouter } from "./trpc";

/**
 * Memory router -- service-accessible procedures.
 * Accessible via /api/trpc/memory/*
 *
 * Sub-routers will be added as features are implemented:
 * - connections.*: Connection lifecycle operations
 * - ingest.*: Webhook ingestion operations
 * - pipeline.*: Neural pipeline operations
 */
export const memoryRouter = createTRPCRouter({
  // Empty initially -- sub-routers added in later phases
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
