type ClerkAuthSession = {
  has: () => boolean;
  orgId: null;
  userId: null;
};

function unsupportedClerkClient(): never {
  throw new Error(
    "Clerk server client is not wired for app-tanstack yet. Use the TanStack auth integration layer before calling Clerk-backed procedures."
  );
}

export async function auth(): Promise<ClerkAuthSession> {
  return {
    has: () => false,
    orgId: null,
    userId: null,
  };
}

export async function clerkClient() {
  return unsupportedClerkClient();
}

export function toPlainClerkResource<T>(resource: T): T {
  return structuredClone(resource);
}

export function createRouteMatcher() {
  return () => false;
}

export function getAuth(): ClerkAuthSession {
  return {
    has: () => false,
    orgId: null,
    userId: null,
  };
}

export async function currentUser() {
  return null;
}

export async function verifyToken() {
  return unsupportedClerkClient();
}

export function buildClerkProps() {
  return {};
}

export function clerkMiddleware() {
  return unsupportedClerkClient();
}

export function createClerkClient() {
  return unsupportedClerkClient();
}

export function reverificationError() {
  return unsupportedClerkClient();
}

export function reverificationErrorResponse() {
  return unsupportedClerkClient();
}
