import { BlobError, del, head, list, put } from "@vercel/blob";

import type { Logger } from "@vendor/observability/log";
import { parseError } from "@vendor/observability/error";

import { env } from "../env";

export enum StorageOperationType {
  Upload = "Upload",
  Delete = "Delete",
  List = "List",
  GetMetadata = "GetMetadata",
}

export interface StorageOptions {
  addRandomSuffix?: boolean;
  token?: string;
  logger?: Logger;
}

export interface ListOptions extends StorageOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

const defaultOptions = {
  addRandomSuffix: false,
  token: env.BLOB_READ_WRITE_TOKEN,
  access: "public" as const,
};

class StorageOperation {
  constructor(
    private readonly operation: StorageOperationType,
    private readonly path: string,
    private readonly logger?: Logger,
  ) {}

  private formatError(error: unknown) {
    if (error instanceof BlobError) {
      return {
        message: error.message,
        name: error.name,
        type: error.constructor.name,
      };
    }
    return { error: parseError(error) };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.logger?.debug(`${this.operation} succeeded`, {
        path: this.path,
      });
      return result;
    } catch (error) {
      this.logger?.error(`${this.operation} failed`, {
        path: this.path,
        ...this.formatError(error),
      });
      throw error;
    }
  }
}

export const storage = {
  /**
   * Upload a file to Vercel Blob
   */
  upload: async (
    path: string,
    content: string | Buffer | Uint8Array,
    options?: StorageOptions,
  ) => {
    const op = new StorageOperation(
      StorageOperationType.Upload,
      path,
      options?.logger,
    );
    return op.execute(() =>
      put(path, content, {
        ...defaultOptions,
        addRandomSuffix:
          options?.addRandomSuffix ?? defaultOptions.addRandomSuffix,
        token: options?.token ?? defaultOptions.token,
      }),
    );
  },

  /**
   * Delete a file from Vercel Blob
   */
  delete: async (url: string, options?: StorageOptions) => {
    const op = new StorageOperation(
      StorageOperationType.Delete,
      url,
      options?.logger,
    );
    return op.execute(() =>
      del(url, {
        token: options?.token ?? defaultOptions.token,
      }),
    );
  },

  /**
   * List files in Vercel Blob
   */
  list: async (options?: ListOptions) => {
    const op = new StorageOperation(
      StorageOperationType.List,
      options?.prefix ?? "root",
      options?.logger,
    );
    return op.execute(() =>
      list({
        token: options?.token ?? defaultOptions.token,
        prefix: options?.prefix,
        limit: options?.limit,
        cursor: options?.cursor,
      }),
    );
  },

  /**
   * Get file metadata from Vercel Blob
   */
  head: async (url: string, options?: StorageOptions) => {
    const op = new StorageOperation(
      StorageOperationType.GetMetadata,
      url,
      options?.logger,
    );
    return op.execute(() =>
      head(url, {
        token: options?.token ?? defaultOptions.token,
      }),
    );
  },
};

export type {
  PutBlobResult,
  HeadBlobResult,
  ListBlobResult,
} from "@vercel/blob";
