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
}
