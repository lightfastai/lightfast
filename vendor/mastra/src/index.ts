/**
 * @vendor/mastra
 *
 * Vendor abstraction for Mastra workflows and agents.
 *
 * This package intentionally stays generic: it wires Mastra core into the
 * Lightfast monorepo and re-exports core primitives so product packages
 * (like @repo/cms-workflows) can define their own workflows.
 *
 * Domain-specific workflows (e.g. blog, ingestion, AEO) should live in
 * their owning packages, not in this vendor wrapper.
 */

export { Mastra } from "@mastra/core/mastra";
export { createWorkflow, createStep } from "@mastra/core/workflows/vNext";

