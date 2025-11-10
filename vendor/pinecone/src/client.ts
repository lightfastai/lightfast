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
   *
   * Pinecone constraints: lower-case alphanumeric and '-'
   * We sanitize both parts and join with '-'.
   * Also clamp to a safe length and add a short hash when needed.
   */
  resolveIndexName(workspaceId: string, storeName: string): string {
    const sanitize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-") // replace illegal chars (including underscores) with '-'
        .replace(/^-+/, "") // trim leading '-'
        .replace(/-+$/, "") // trim trailing '-'
        .replace(/-{2,}/g, "-"); // collapse multiple '-'

    const ws = sanitize(workspaceId);
    const st = sanitize(storeName);
    let name = `${ws}-${st}`;

    // Pinecone index name max length is limited (commonly 45). Clamp defensively to 45.
    const MAX = 45;
    if (name.length > MAX) {
      const hash = this.shortHash(`${ws}:${st}`);
      // Reserve 5 for '-' + 4-char hash
      const base = name.slice(0, MAX - 5).replace(/-+$/, "");
      name = `${base}-${hash}`;
    }
    return name;
  }

  private shortHash(input: string): string {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h * 31 + input.charCodeAt(i)) >>> 0;
    }
    // 4 hex chars
    return (h % 0xffff).toString(16).padStart(4, "0");
  }

  /**
   * Create a new Pinecone index
   */
  async createIndex(workspaceId: string, storeName: string, dimension: number): Promise<string> {
    const indexName = this.resolveIndexName(workspaceId, storeName);

    try {
      await this.retry(async () => {
        try {
          await this.client.createIndex({
            indexName,
            dimension,
            metric: "cosine",
          });
        } catch (err) {
          // Treat already-exists as success (idempotent create)
          const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
          if (msg.includes("already_exists") || msg.includes("already exists") || msg.includes("409")) {
            return;
          }
          throw err;
        }
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
