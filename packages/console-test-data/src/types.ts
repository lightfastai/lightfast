/**
 * Core types for test data generation
 */

import type { SourceType } from "@repo/console-validation";

/**
 * Test observation template
 */
export interface TestObservation {
  source: SourceType;
  sourceType: string;
  title: string;
  body: string;
  actorName: string;
  /** Days ago from injection time */
  daysAgo: number;
  /** Optional category for grouping */
  category?: string;
  /** Optional tags for filtering */
  tags?: string[];
}

/**
 * Test actor definition
 */
export interface TestActor {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

/**
 * Workspace target for injection
 */
export interface WorkspaceTarget {
  workspaceId: string;
  clerkOrgId: string;
}

/**
 * Injection options
 */
export interface InjectionOptions {
  /** Dry run - preview without inserting */
  dryRun?: boolean;
  /** Batch size for Pinecone upserts (default: 100) */
  batchSize?: number;
  /** Clear existing test data before injection */
  clearExisting?: boolean;
  /** Custom prefix for sourceIds */
  sourceIdPrefix?: string;
  /** Callback for progress updates */
  onProgress?: (current: number, total: number, observation: TestObservation) => void;
}

/**
 * Injection result
 */
export interface InjectionResult {
  success: boolean;
  observationsCreated: number;
  vectorsUpserted: number;
  errors: string[];
  namespace: string;
  duration: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  success: boolean;
  database: {
    count: number;
    byType: Record<string, number>;
    byActor: Record<string, number>;
    bySource: Record<string, number>;
  };
  pinecone: {
    count: number;
    byType: Record<string, number>;
  };
  mismatches: string[];
}

/**
 * Test scenario definition
 */
export interface TestScenario {
  name: string;
  description: string;
  observations: TestObservation[];
  expectedResults: ScenarioExpectation[];
}

/**
 * Expected result for a test scenario query
 */
export interface ScenarioExpectation {
  name: string;
  query: string;
  filters?: {
    sourceTypes?: string[];
    observationTypes?: string[];
    actorNames?: string[];
    dateRange?: { start?: string; end?: string };
  };
  expectedBehavior: string;
  minResults?: number;
  maxResults?: number;
  llmShouldTrigger?: boolean;
}
