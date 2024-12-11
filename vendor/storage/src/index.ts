import { del, head, list, put } from "@vercel/blob";

import { env } from "../env";

export interface StorageOptions {
  addRandomSuffix?: boolean;
  token?: string;
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

export const storage = {
  /**
   * Upload a file to Vercel Blob
   */
  put: async (
    path: string,
    content: string | Buffer | Uint8Array,
    options?: StorageOptions,
  ) => {
    return put(path, content, {
      ...defaultOptions,
      ...options,
    });
  },

  /**
   * Delete a file from Vercel Blob
   */
  delete: async (url: string, options?: StorageOptions) => {
    return del(url, {
      token: options?.token || defaultOptions.token,
    });
  },

  /**
   * List files in Vercel Blob
   */
  list: async (options?: ListOptions) => {
    return list({
      token: options?.token || defaultOptions.token,
      prefix: options?.prefix,
      limit: options?.limit,
      cursor: options?.cursor,
    });
  },

  /**
   * Get file metadata from Vercel Blob
   */
  head: async (url: string, options?: StorageOptions) => {
    return head(url, {
      token: options?.token || defaultOptions.token,
    });
  },
};

export type {
  PutBlobResult,
  HeadBlobResult,
  ListBlobResult,
} from "@vercel/blob";
