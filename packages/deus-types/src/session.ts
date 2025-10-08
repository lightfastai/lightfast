/**
 * Shared session types used by the Deus API and clients.
 */

export interface DeusSession {
  userId: string | null;
}

export interface AuthenticatedDeusSession {
  userId: string;
}
