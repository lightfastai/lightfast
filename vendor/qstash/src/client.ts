import type {
  PublishToUrlGroupsResponse,
  PublishToUrlResponse,
} from "@upstash/qstash";
import { Client } from "@upstash/qstash";
import { qstashEnv } from "../env";

export interface PublishJsonOptions<TBody = unknown> {
  body?: TBody;
  callback?: string;
  deduplicationId?: string;
  delay?: number;
  headers?: Record<string, string>;
  retries?: number;
  url: string;
}

export interface PublishToTopicOptions<TBody = unknown> {
  body?: TBody;
  deduplicationId?: string;
  delay?: number;
  headers?: Record<string, string>;
  retries?: number;
  topic: string;
}

export interface QStashPublishResponse {
  deduplicated?: boolean;
  messageId: string;
  url?: string;
}

/**
 * QStash client wrapper
 *
 * Provides a typed interface for publishing messages to QStash
 * for durable, at-least-once delivery.
 */
export class QStashClient {
  private readonly client: Client;

  constructor(token?: string) {
    this.client = new Client({
      token: token ?? qstashEnv.QSTASH_TOKEN,
    });
  }

  /**
   * Publish a JSON message to a URL endpoint for durable delivery
   */
  async publishJSON<TBody = unknown>(
    options: PublishJsonOptions<TBody>
  ): Promise<QStashPublishResponse> {
    const { url, body, headers, retries, delay, deduplicationId, callback } =
      options;

    const result: PublishToUrlResponse = await this.client.publishJSON({
      url,
      body,
      headers,
      ...(retries !== undefined && { retries }),
      ...(delay !== undefined && { delay }),
      ...(deduplicationId !== undefined && { deduplicationId }),
      ...(callback !== undefined && { callback }),
    });

    return {
      messageId: result.messageId,
      url: result.url,
      deduplicated: result.deduplicated,
    };
  }

  /**
   * Publish a JSON message to a QStash topic
   */
  async publishToTopic<TBody = unknown>(
    options: PublishToTopicOptions<TBody>
  ): Promise<QStashPublishResponse[]> {
    const { topic, body, headers, retries, delay, deduplicationId } = options;

    const result: PublishToUrlGroupsResponse = await this.client.publishJSON({
      urlGroup: topic,
      body,
      headers,
      ...(retries !== undefined && { retries }),
      ...(delay !== undefined && { delay }),
      ...(deduplicationId !== undefined && { deduplicationId }),
    });

    return result.map((r) => ({
      messageId: r.messageId,
      url: r.url,
      deduplicated: r.deduplicated,
    }));
  }
}

let clientInstance: QStashClient | null = null;
let currentToken: string | undefined;

/**
 * Get or create the default QStash client singleton
 */
export function getQStashClient(token?: string): QStashClient {
  if (!clientInstance || token !== currentToken) {
    clientInstance = new QStashClient(token);
    currentToken = token;
  }
  return clientInstance;
}
