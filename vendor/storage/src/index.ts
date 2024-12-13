import { BlobError, del, head, list, put } from "@vercel/blob";

import type { Logger } from "@vendor/observability/log";
import { AsyncExecutor } from "@vendor/observability/async-executor";
import { TypedErrorFormatter } from "@vendor/observability/error-formatter";

import { env } from "../env";

export enum StorageEvent {
  Upload = "Upload",
  Delete = "Delete",
  List = "List",
  GetMeta = "GetMetadata",
  Get = "Get",
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

function createExecutor(
  operation: StorageEvent,
  path: string,
  logger?: Logger,
) {
  return new AsyncExecutor<StorageEvent, string>(
    operation,
    path,
    logger,
    new TypedErrorFormatter(BlobError, "storage", {
      path,
    }),
  );
}

export const storage = {
  /**
   * Upload a file to Vercel Blob
   */
  upload: async (
    path: string,
    content: string | Buffer | Uint8Array | ReadableStream,
    options?: StorageOptions,
  ) => {
    const op = createExecutor(StorageEvent.Upload, path, options?.logger);
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
   * Download a file from Vercel Blob
   */
  get: async (url: string, options?: StorageOptions) => {
    const finalUrl = `${env.BLOB_BASE_URI}/${url}`;
    const op = createExecutor(StorageEvent.Get, finalUrl, options?.logger);
    return await op.execute(() => fetch(finalUrl));
  },

  /**
   * Delete a file from Vercel Blob
   */
  delete: async (url: string, options?: StorageOptions) => {
    const op = createExecutor(StorageEvent.Delete, url, options?.logger);
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
    const op = createExecutor(
      StorageEvent.List,
      options?.prefix ?? "root",
      options?.logger,
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
    const op = createExecutor(StorageEvent.GetMeta, url, options?.logger);
    return await op.execute(() =>
      head(url, {
        token: options?.token ?? defaultOptions.token,
      }),
    );
  },
};

export * from "@vercel/blob";
