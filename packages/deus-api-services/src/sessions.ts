import { DeusApiService } from "./base-service";

export class SessionsService extends DeusApiService {
  /**
   * List sessions for an organization with optional filtering and pagination
   *
   * @param organizationId - The organization ID to list sessions for
   * @param options - Optional filters and pagination params
   * @returns Sessions with pagination metadata
   */
  async listSessions(
    organizationId: string,
    options?: {
      limit?: number;
      cursor?: string;
      status?: "active" | "paused" | "completed";
    },
  ) {
    return await this.call(
      "session.list",
      (caller) =>
        caller.session.list({
          organizationId,
          limit: options?.limit,
          cursor: options?.cursor,
          status: options?.status,
        }),
      {
        fallbackMessage: "Failed to list sessions",
        details: { organizationId, ...options },
      },
    );
  }

  /**
   * Get a single session by ID
   *
   * @param sessionId - The session ID to retrieve
   * @returns Session metadata (without messages)
   */
  async getSession(sessionId: string) {
    return await this.call(
      "session.get",
      (caller) => caller.session.get({ id: sessionId }),
      {
        fallbackMessage: "Failed to get session",
        details: { sessionId },
      },
    );
  }

  /**
   * Get messages for a session with pagination
   *
   * @param sessionId - The session ID to get messages for
   * @param options - Optional pagination params
   * @returns Messages with pagination metadata
   */
  async getSessionMessages(
    sessionId: string,
    options?: {
      limit?: number;
      cursor?: string;
    },
  ) {
    return await this.call(
      "session.getMessages",
      (caller) =>
        caller.session.getMessages({
          sessionId,
          limit: options?.limit,
          cursor: options?.cursor,
        }),
      {
        fallbackMessage: "Failed to get session messages",
        details: { sessionId, ...options },
      },
    );
  }

  /**
   * INTERNAL: Get session by ID (no auth check)
   *
   * This method should ONLY be called from contexts where authentication
   * has already been performed (e.g., API routes with API key validation).
   * Do not call this from client-facing code.
   *
   * @param sessionId - The session ID to retrieve
   * @returns Session or null if not found
   */
  async getSessionInternal(sessionId: string) {
    return await this.call(
      "session.getInternal",
      (caller) => caller.session.getInternal({ id: sessionId }),
      {
        fallbackMessage: "Failed to get session",
        details: { sessionId },
        suppressCodes: ["NOT_FOUND"],
        recover: (error) => {
          if (error.code === "NOT_FOUND") {
            return null;
          }
          throw error;
        },
      },
    );
  }

  /**
   * INTERNAL: Get messages for a session (no auth check)
   *
   * This method should ONLY be called from contexts where authentication
   * has already been performed. Returns messages in descending order (newest first).
   *
   * @param sessionId - The session ID to get messages for
   * @param limit - Maximum number of messages to return (default: 100)
   * @returns Array of messages
   */
  async getSessionMessagesInternal(sessionId: string, limit?: number) {
    return await this.call(
      "session.getMessagesInternal",
      (caller) =>
        caller.session.getMessagesInternal({
          sessionId,
          limit,
        }),
      {
        fallbackMessage: "Failed to get session messages",
        details: { sessionId, limit },
      },
    );
  }

  /**
   * INTERNAL: Add a message to a session (no auth check)
   *
   * This method should ONLY be called from contexts where authentication
   * has already been performed.
   *
   * @param params - Message parameters
   * @returns Success indicator
   */
  async addMessageInternal(params: {
    id: string;
    sessionId: string;
    role: "system" | "user" | "assistant";
    parts: unknown[];
    charCount: number;
    modelId?: string | null;
  }) {
    return await this.call(
      "session.addMessageInternal",
      (caller) => caller.session.addMessageInternal(params),
      {
        fallbackMessage: "Failed to add message to session",
        details: { sessionId: params.sessionId, messageId: params.id },
      },
    );
  }
}
