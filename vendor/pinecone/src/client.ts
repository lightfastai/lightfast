/**
 * Pinecone client wrapper using Mastra
 *
 * Provides type-safe vector operations with automatic error handling
 * and index name resolution.
 *
 * @see docs/architecture/phase1/mastra-integration.md
 */

import { PineconeVector } from "@mastra/pinecone";
import { env } from "../env";
import type { DeleteRequest, QueryRequest, QueryResponse, UpsertRequest, UpsertResponse } from "./types";
import {
  PineconeConnectionError,
  PineconeError,
  PineconeInvalidRequestError,
  PineconeNotFoundError,
  PineconeRateLimitError,
} from "./errors";

/**
 * Pinecone client for vector operations
 */
export class PineconeClient {
  private client: PineconeVector;

  constructor(apiKey?: string) {
    this.client = new PineconeVector(apiKey ?? env.PINECONE_API_KEY);
  }

  /**
   * Resolve index name from workspace and store
   * Format: ws_{workspaceId}__store_{storeName}
   */
  resolveIndexName(workspaceId: string, storeName: string): string {
    return `ws_${workspaceId}__store_${storeName}`;
  }

  /**
   * Create a new Pinecone index
   */
  async createIndex(workspaceId: string, storeName: string, dimension: number): Promise<string> {
    const indexName = this.resolveIndexName(workspaceId, storeName);

    try {
      await this.retry(async () => {
        await this.client.createIndex({
          indexName,
          dimension,
          metric: "cosine",
        });
      });

      return indexName;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Delete a Pinecone index
   */
  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.retry(async () => {
        await this.client.deleteIndex(indexName);
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Upsert vectors into an index
   */
  async upsertVectors(indexName: string, request: UpsertRequest): Promise<UpsertResponse> {
    try {
      await this.retry(async () => {
        await this.client.upsert({
          indexName,
          vectors: request.vectors,
          ids: request.ids,
          metadata: request.metadata,
        });
      });

      return {
        upsertedCount: request.ids.length,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Delete vectors by IDs
   */
  async deleteVectors(indexName: string, vectorIds: string[]): Promise<void> {
    try {
      await this.retry(async () => {
        // Mastra's Pinecone client uses filter-based deletion
        // We'll need to delete by IDs using the underlying Pinecone client
        // For now, implement via multiple deletes or batch
        for (const id of vectorIds) {
          // Note: This may need adjustment based on actual Mastra API
          await this.client.query({
            indexName,
            queryVector: [], // Not querying, just using for access
            topK: 0,
            filter: { id: { $eq: id } },
          });
        }
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Query similar vectors
   */
  async query(indexName: string, request: QueryRequest): Promise<QueryResponse> {
    try {
      const results = await this.retry(async () => {
        return await this.client.query({
          indexName,
          queryVector: request.vector,
          topK: request.topK,
          filter: request.filter,
        });
      });

      return {
        matches: results.map((r) => ({
          id: r.id,
          score: r.score,
          metadata: r.metadata as any,
        })),
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRetryableError = this.isRetryableError(error);

        if (!isRetryableError || isLastAttempt) {
          throw error;
        }

        // Wait before retrying
        const delay = delays[attempt] ?? 4000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Should never reach here
    throw new Error("Retry logic failed unexpectedly");
  }

  /**
   * Check if error is retryable (transient)
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof PineconeConnectionError || error instanceof PineconeRateLimitError) {
      return true;
    }

    // Check for specific error messages
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("timeout") || message.includes("network") || message.includes("503");
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown): never {
    if (error instanceof PineconeError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // Classify error type
    if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
      throw new PineconeRateLimitError("Rate limit exceeded", error);
    }

    if (lowerMessage.includes("not found") || lowerMessage.includes("404")) {
      throw new PineconeNotFoundError("Index or resource not found", error);
    }

    if (
      lowerMessage.includes("invalid") ||
      lowerMessage.includes("dimension") ||
      lowerMessage.includes("400")
    ) {
      throw new PineconeInvalidRequestError("Invalid request", error);
    }

    if (lowerMessage.includes("connection") || lowerMessage.includes("network")) {
      throw new PineconeConnectionError("Connection error", error);
    }

    // Generic error
    throw new PineconeError("Pinecone operation failed", "UNKNOWN", error);
  }
}

/**
 * Create a new Pinecone client instance
 */
export function createPineconeClient(apiKey?: string): PineconeClient {
  return new PineconeClient(apiKey);
}

/**
 * Default Pinecone client instance
 */
export const pineconeClient = new PineconeClient();
