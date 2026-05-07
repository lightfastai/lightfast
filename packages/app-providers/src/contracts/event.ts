/**
 * Post-Transform Event types — stub.
 *
 * The transformer pipeline was removed in the 2026-05-06 barebones reset.
 * Only type aliases survive here so Phase 5 db schema files
 * (`org-ingest-logs`, `org-events`) keep compiling until they are dropped
 * alongside this file.
 */

export interface EntityRelation {
  entityId: string;
  entityType: string;
  provider: string;
  relationshipType: string;
  title: string | null;
  url: string | null;
}

export interface PostTransformEvent {
  attributes: Record<string, string | number | boolean | null>;
  body: string;
  deliveryId: string;
  entity: {
    entityId: string;
    entityType: string;
    provider: string;
    state: string | null;
    title: string;
    url: string | null;
  };
  eventType: string;
  occurredAt: string;
  provider: string;
  relations: EntityRelation[];
  sourceId: string;
  title: string;
}
