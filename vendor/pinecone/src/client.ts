/**
 * Pinecone client wrapper built on the official SDK.
 *
 * Provides typed vector operations and index name helpers tailored to our store model.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import type { RecordMetadata } from "@pinecone-database/pinecone";

import { env } from "../env";
import type { QueryRequest, QueryResponse, UpsertRequest, UpsertResponse } from "./types";
import {
  PineconeConnectionError,
  PineconeError,
  PineconeInvalidRequestError,
  PineconeNotFoundError,
  PineconeRateLimitError,
} from "./errors";

export class PineconeClient {
  private client: Pinecone;

  constructor() {
    this.client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
  }

  /**
   * Create a new Pinecone index (serverless)
   *
   * All parameters are required - caller must provide explicit configuration.
   * Use application-level wrapper (@repo/console-pinecone) for defaults.
   *
   * @param indexName - Name of the index to create
   * @param dimension - Embedding dimension
   * @param options - Required configuration
   */
  async createIndex(
    indexName: string,
    dimension: number,
    options: {
      metric: "cosine" | "euclidean" | "dotproduct";
      cloud: "aws" | "gcp" | "azure";
      region: string;
    }
  ): Promise<void> {
    try {
      await this.client.createIndex({
        name: indexName,
        dimension,
        metric: options.metric,
        spec: {
          serverless: {
            cloud: options.cloud,
            region: options.region,
          },
        },
        suppressConflicts: true,
        waitUntilReady: true,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Check if an index exists
   *
   * @param indexName - Name of the index to check
   * @returns true if index exists, false otherwise
   */
  async indexExists(indexName: string): Promise<boolean> {
    try {
      const indexes = await this.client.listIndexes();
      const indexList = indexes.indexes ?? [];
      return indexList.some(index => index.name === indexName);
    } catch (error) {
      // If list fails, assume index doesn't exist
      console.warn(`Failed to check index existence: ${error}`);
      return false;
    }
  }

  /**
   * Delete a Pinecone index
   */
  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.client.deleteIndex(indexName);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Upsert vectors into an index
   *
   * Generic method - works with any metadata type extending RecordMetadata
   */
  async upsertVectors<T extends RecordMetadata = RecordMetadata>(
    indexName: string,
    request: UpsertRequest<T>,
    batchSize = 100
  ): Promise<UpsertResponse> {
    const index = this.client.index(indexName);

    try {
      for (let i = 0; i < request.ids.length; i += batchSize) {
        const ids = request.ids.slice(i, i + batchSize);
        const vectors = request.vectors.slice(i, i + batchSize);
        const metadata = request.metadata.slice(i, i + batchSize);

        const records = vectors.map((values, offset) => ({
          id: ids[offset]!,
          values,
          metadata: metadata[offset]!,
        }));

        await index.upsert(records);
      }

      return { upsertedCount: request.ids.length };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Delete vectors by IDs
   */
  async deleteVectors(indexName: string, vectorIds: string[], batchSize = 100): Promise<void> {
    if (vectorIds.length === 0) return;

    const index = this.client.index(indexName);

    try {
      for (let i = 0; i < vectorIds.length; i += batchSize) {
        const batch = vectorIds.slice(i, i + batchSize);
        await index.deleteMany(batch);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Delete vectors matching a metadata filter
   */
  async deleteByMetadata(indexName: string, filter: object): Promise<void> {
    const index = this.client.index(indexName);

    try {
      await index.deleteMany(filter);
    } catch (error) {
      this.handleError(error);
    }
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
    try {
      await this.client.configureIndex(indexName, {
        deletionProtection: options.deletionProtection,
        spec: options.spec as never,
        tags: options.tags,
      });
    } catch (error) {
      this.handleError(error);
    }
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
    const index = this.client.index(indexName);

    try {
      const results = await index.query({
        vector: request.vector,
        topK: request.topK,
        filter: request.filter,
        includeMetadata: request.includeMetadata ?? true,
      });

      return {
        matches: results.matches?.map((match) => ({
          id: match.id,
          score: match.score ?? 0,
          metadata: match.metadata as T,
        })) ?? [],
      };
    } catch (error) {
      this.handleError(error);
    }
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

    throw new PineconeError("Pinecone operation failed", "UNKNOWN", error);
  }
}

export function createPineconeClient(): PineconeClient {
  return new PineconeClient();
}

export const pineconeClient = new PineconeClient();
