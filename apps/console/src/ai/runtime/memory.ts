import { Redis } from "@upstash/redis";
import type { UIMessage } from "ai";
import type { Memory } from "@lightfastai/ai-sdk/memory";
import type { AnswerMemoryContext } from "../types";

interface SessionMessagesData<TMessage> {
  messages: TMessage[];
}

type RedisJsonData<T> = T & Record<string, unknown>;

interface SessionData {
  resourceId: string;
}

/**
 * Ephemeral Redis memory for Answer sessions.
 * 1-hour TTL on all data - workspace search conversations are transient.
 * Follows the pattern of AnonymousRedisMemory from apps/chat
 */
export class AnswerRedisMemory
  implements Memory<UIMessage, AnswerMemoryContext>
{
  private redis: Redis;

  // Redis key patterns with answer: prefix
  private readonly KEYS = {
    sessionMetadata: (sessionId: string) => `answer:session:${sessionId}:metadata`,
    sessionMessages: (sessionId: string) => `answer:session:${sessionId}:messages`,
    sessionActiveStream: (sessionId: string) => `answer:session:${sessionId}:active_stream`,
    sessionStreams: (sessionId: string) => `answer:session:${sessionId}:streams`,
    stream: (streamId: string) => `answer:stream:${streamId}`,
  } as const;

  // Ephemeral TTL - 1 hour for all data
  private readonly TTL = {
    SESSION: 3600, // 1 hour - sessions are transient
    MESSAGES: 3600, // 1 hour
    STREAM: 3600, // 1 hour
  } as const;

  constructor(config?: { url?: string; token?: string }) {
    const url = config?.url ?? process.env.KV_REST_API_URL;
    const token = config?.token ?? process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required");
    }

    this.redis = new Redis({
      url,
      token,
    });
  }

  async appendMessage({
    sessionId,
    message,
    context: _context,
  }: {
    sessionId: string;
    message: UIMessage;
    context?: AnswerMemoryContext;
  }): Promise<void> {
    const key = this.KEYS.sessionMessages(sessionId);

    // Check if the key exists first
    const exists = await this.redis.exists(key);

    if (!exists) {
      // Initialize with the first message if session doesn't exist
      const data: SessionMessagesData<UIMessage> = { messages: [message] };
      // Type assertion is safe here - we know the structure matches
      await this.redis.json.set(
        key,
        "$",
        data as RedisJsonData<SessionMessagesData<UIMessage>>
      );
      // Set TTL on message list
      await this.redis.expire(key, this.TTL.MESSAGES);
    } else {
      // Append to existing messages array
      await this.redis.json.arrappend(key, "$.messages", message);
      // Refresh TTL
      await this.redis.expire(key, this.TTL.MESSAGES);
    }
  }

  async getMessages(sessionId: string): Promise<UIMessage[]> {
    const key = this.KEYS.sessionMessages(sessionId);

    // Use JSON.GET for JSON-stored data
    const jsonData = await this.redis.json.get(key, "$");
    if (jsonData && Array.isArray(jsonData) && jsonData.length > 0) {
      const firstItem = jsonData[0] as { messages?: UIMessage[] };
      return firstItem.messages ?? [];
    }

    return [];
  }

  async createSession({
    sessionId,
    resourceId,
    context: _context,
  }: {
    sessionId: string;
    resourceId: string;
    context?: AnswerMemoryContext;
  }): Promise<void> {
    const key = this.KEYS.sessionMetadata(sessionId);

    // Check if session already exists
    const existing = await this.redis.get(key);
    if (existing) {
      return;
    }

    const data: SessionData = {
      resourceId,
    };

    // Set session with TTL
    await this.redis.setex(key, this.TTL.SESSION, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<{ resourceId: string } | null> {
    const key = this.KEYS.sessionMetadata(sessionId);
    const data = await this.redis.get(key);

    if (!data) return null;

    // Handle both string and already-parsed data
    let sessionData: SessionData;
    if (typeof data === "string") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      sessionData = JSON.parse(data);
    } else {
      sessionData = data as SessionData;
    }

    return { resourceId: sessionData.resourceId };
  }

  async createStream({
    sessionId,
    streamId,
    context: _context,
  }: {
    sessionId: string;
    streamId: string;
    context?: AnswerMemoryContext;
  }): Promise<void> {
    // Set as active stream for this session with TTL
    await this.redis.setex(
      this.KEYS.sessionActiveStream(sessionId),
      this.TTL.STREAM,
      streamId
    );

    // Legacy: Also maintain stream list for backward compatibility
    await this.redis.lpush(this.KEYS.sessionStreams(sessionId), streamId);
    await this.redis.ltrim(this.KEYS.sessionStreams(sessionId), 0, 99);
    // Set TTL on stream list
    await this.redis.expire(this.KEYS.sessionStreams(sessionId), this.TTL.STREAM);
  }

  async getSessionStreams(sessionId: string): Promise<string[]> {
    // Legacy method - prefer getActiveStream() for new code
    const activeStreamId = await this.getActiveStream(sessionId);
    return activeStreamId ? [activeStreamId] : [];
  }

  async getActiveStream(sessionId: string): Promise<string | null> {
    const streamId = await this.redis.get(
      this.KEYS.sessionActiveStream(sessionId)
    );
    return typeof streamId === "string" ? streamId : null;
  }

  async clearActiveStream(sessionId: string): Promise<void> {
    await this.redis.del(this.KEYS.sessionActiveStream(sessionId));
  }
}
