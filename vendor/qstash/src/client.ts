import type {
  PublishToUrlResponse,
  PublishToApiResponse,
} from "@upstash/qstash";
import { Client } from "@upstash/qstash";
import { qstashEnv } from "../env";

export interface PublishJsonOptions<TBody = unknown> {
  url: string;
  body?: TBody;
  headers?: Record<string, string>;
  retries?: number;
  delay?: number;
  deduplicationId?: string;
  callback?: string;
}

export interface PublishToTopicOptions<TBody = unknown> {
  topic: string;
  body?: TBody;
  headers?: Record<string, string>;
  retries?: number;
  delay?: number;
  deduplicationId?: string;
}

export interface QStashPublishResponse {
  messageId: string;
  url?: string;
  deduplicated?: boolean;
}

/**
 * QStash client wrapper
 *
 * Provides a typed interface for publishing messages to QStash
 * for durable, at-least-once delivery.
 */
export class QStashClient {
  private client: Client;

  constructor(token?: string) {
    this.client = new Client({
      token: token ?? qstashEnv.QSTASH_TOKEN,
    });
  }

  /**
   * Publish a JSON message to a URL endpoint for durable delivery
   */
  async publishJSON<TBody = unknown>(
    options: PublishJsonOptions<TBody>,
  ): Promise<QStashPublishResponse> {
    const { url, body, headers, retries, delay, deduplicationId, callback } =
      options;

    const result: PublishToUrlResponse = await this.client.publishJSON({
      url,
      body,
      headers,
      ...(retries !== undefined && { retries }),
      ...(delay !== undefined && { delay }),
      ...(deduplicationId && { deduplicationId }),
      ...(callback && { callback }),
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
    options: PublishToTopicOptions<TBody>,
  ): Promise<QStashPublishResponse[]> {
    const { topic, body, headers, retries, delay, deduplicationId } = options;

    // Publishing to a topic returns a single response (not a URL-based response)
    const result: PublishToApiResponse = await this.client.publishJSON({
      topic,
      body,
      headers,
      ...(retries !== undefined && { retries }),
      ...(delay !== undefined && { delay }),
      ...(deduplicationId && { deduplicationId }),
    });

    return [{ messageId: result.messageId }];
  }
}

let clientInstance: QStashClient | null = null;
let currentToken: string | undefined;

/**
 * Get or create the default QStash client singleton
 */
export function getQStashClient(token?: string): QStashClient {
  if (!clientInstance || (token && token !== currentToken)) {
    clientInstance = new QStashClient(token);
    currentToken = token;
  }
  return clientInstance;
}
