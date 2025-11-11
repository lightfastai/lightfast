/**
 * Console-specific Pinecone client wrapper
 *
 * Wraps @vendor/pinecone and injects configuration from @repo/console-config.
 * Provides a convenience API with sensible defaults for the console application.
 */

import { PineconeClient as VendorPineconeClient } from "@vendor/pinecone/client";
import { PINECONE_CONFIG } from "@repo/console-config";
import type { UpsertRequest, UpsertResponse, QueryRequest, QueryResponse } from "@vendor/pinecone/types";
import type { RecordMetadata } from "@pinecone-database/pinecone";

/**
 * Console-specific Pinecone client with injected configuration
 *
 * This wrapper provides the same API as @vendor/pinecone but automatically
 * injects private configuration defaults from @repo/console-config.
 */
export class ConsolePineconeClient {
  private client: VendorPineconeClient;

  constructor() {
    this.client = new VendorPineconeClient();
  }

  /**
   * Create index with console configuration defaults
   *
   * Automatically injects:
   * - metric: "cosine"
   * - cloud: "aws"
   * - region: "us-west-2"
   */
  async createIndex(indexName: string, dimension: number): Promise<void> {
    return this.client.createIndex(indexName, dimension, {
      metric: PINECONE_CONFIG.metric,
      cloud: PINECONE_CONFIG.cloud,
      region: PINECONE_CONFIG.region,
    });
  }

  /**
   * Check if a Pinecone index exists
   *
   * @param indexName - Name of the index to check
   * @returns true if index exists, false otherwise
   */
  async indexExists(indexName: string): Promise<boolean> {
    return this.client.indexExists(indexName);
  }

  /**
   * Delete a Pinecone index
   */
  async deleteIndex(indexName: string): Promise<void> {
    return this.client.deleteIndex(indexName);
  }

  /**
   * Upsert vectors with automatic batching based on console config
   *
   * Generic method - works with any metadata type extending RecordMetadata
   */
  async upsertVectors<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    request: UpsertRequest<T>
  ): Promise<UpsertResponse> {
    return this.client.upsertVectors(
      indexName,
      request,
      PINECONE_CONFIG.upsertBatchSize
    );
  }

  /**
   * Delete vectors by IDs
   */
  async deleteVectors(indexName: string, vectorIds: string[]): Promise<void> {
    return this.client.deleteVectors(
      indexName,
      vectorIds,
      PINECONE_CONFIG.deleteBatchSize
    );
  }

  /**
   * Delete vectors by metadata filter
   */
  async deleteByMetadata(indexName: string, filter: object): Promise<void> {
    return this.client.deleteByMetadata(indexName, filter);
  }

  /**
   * Query similar vectors
   *
   * Generic method - works with any metadata type extending RecordMetadata
   */
  async query<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    request: QueryRequest
  ): Promise<QueryResponse<T>> {
    return this.client.query<T>(indexName, request);
  }

  /**
   * Configure index level settings (deletion protection, tags, etc.)
   */
  async configureIndex(
    indexName: string,
    options: {
      deletionProtection?: "enabled" | "disabled";
      tags?: Record<string, string>;
      spec?: unknown;
    }
  ): Promise<void> {
    return this.client.configureIndex(indexName, options);
  }
}

/**
 * Create a new console Pinecone client instance
 */
export function createConsolePineconeClient(): ConsolePineconeClient {
  return new ConsolePineconeClient();
}

/**
 * Default console Pinecone client instance
 *
 * Use this for most operations unless you need a custom instance.
 */
export const consolePineconeClient = new ConsolePineconeClient();
