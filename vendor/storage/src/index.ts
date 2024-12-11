import { BlobError, del, head, list, put } from "@vercel/blob";

import type { Logger } from "@vendor/observability/log";
import { AsyncExecutor } from "@vendor/observability/async-executor";
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

function storageErrorFormatter(error: unknown) {
  if (error instanceof BlobError) {
    return {
      message: error.message,
      name: error.name,
      type: error.constructor.name,
    };
  }
  return { error: parseError(error) };
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
    const op = new AsyncExecutor<StorageOperationType, string>(
      StorageOperationType.Upload,
      path,
      options?.logger,
      storageErrorFormatter,
    );
    return await op.execute(() =>
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
    const op = new AsyncExecutor<StorageOperationType, string>(
      StorageOperationType.Delete,
      url,
      options?.logger,
      storageErrorFormatter,
    );
    return await op.execute(() =>
      del(url, {
        token: options?.token ?? defaultOptions.token,
      }),
    );
  },

  /**
   * List files in Vercel Blob
   */
  list: async (options?: ListOptions) => {
    const op = new AsyncExecutor<StorageOperationType, string>(
      StorageOperationType.List,
      options?.prefix ?? "root",
      options?.logger,
      storageErrorFormatter,
    );
    return await op.execute(() =>
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
    const op = new AsyncExecutor<StorageOperationType, string>(
      StorageOperationType.GetMetadata,
      url,
      options?.logger,
      storageErrorFormatter,
    );
    return await op.execute(() =>
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
