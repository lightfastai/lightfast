import type { ReactNode } from "react";

/**
 * Custom render functions for Lightfast API documentation
 *
 * These functions override fumadocs-openapi's default layout renderers
 * to apply Lightfast-specific branding and styling while maintaining
 * all interactive functionality.
 */

/**
 * Render layout for individual API operations
 *
 * Customizations:
 * - Accent border on header using brand-500
 * - Enhanced sidebar with gradient background
 * - Lightfast shadow and border styling
 */
export function renderOperationLayout(slots: {
  header: ReactNode;
  description: ReactNode;
  apiExample: ReactNode;
  apiPlayground: ReactNode;
  authSchemes: ReactNode;
  paremeters: ReactNode;
  body: ReactNode;
  responses: ReactNode;
  callbacks: ReactNode;
}) {
  return (
    <div className="flex @2xl:flex-row flex-col @2xl:items-start gap-x-6 gap-y-4">
      {/* Main content area */}
      <div className="min-w-0 flex-1">
        {slots.header}
        {slots.apiPlayground}
        <div className="mt-4">{slots.description}</div>
        {slots.authSchemes}
        {slots.paremeters}
        {slots.body}
        {slots.responses}
        {slots.callbacks}
      </div>

      {/* Code examples sidebar */}
      <div className="@2xl:sticky @2xl:top-[calc(var(--fd-docs-row-1,2rem)+1rem)] @2xl:w-[440px]">
        {slots.apiExample}
      </div>
    </div>
  );
}

/**
 * Render page-level layout for all operations and webhooks
 *
 * Applies consistent spacing and container classes across all endpoints
 */
export function renderPageLayout(slots: {
  operations?: {
    item: { path: string; method: string };
    children: ReactNode;
  }[];
  webhooks?: { item: { name: string; method: string }; children: ReactNode }[];
}) {
  return (
    <div className="@container flex flex-col gap-24 text-sm">
      {/* Render all operations */}
      {slots.operations?.map((op) => (
        <div className="relative" key={`${op.item.path}:${op.item.method}`}>
          {op.children}
        </div>
      ))}

      {/* Render all webhooks */}
      {slots.webhooks?.map((op) => (
        <div className="relative" key={`${op.item.name}:${op.item.method}`}>
          {op.children}
        </div>
      ))}
    </div>
  );
}
