import type { NativeSessionMetadata } from "@repo/native-auth-contract";
import { createDesktopNativeAuthClient } from "./app-client";
import { type DesktopNativeSession, getSession, setSession } from "./store";

interface NativeSessionProfileClient {
  session(input: {
    accessToken: string;
    organizationId: string;
  }): Promise<NativeSessionMetadata>;
}

interface SyncNativeSessionProfileInput {
  client?: NativeSessionProfileClient;
  getSession?: () => DesktopNativeSession | null;
  setSession?: (session: DesktopNativeSession) => boolean;
}

function sessionMatchesMetadata(
  session: DesktopNativeSession,
  metadata: NativeSessionMetadata
): boolean {
  return (
    session.organization.id === metadata.organization.id &&
    session.organization.name === metadata.organization.name &&
    session.organization.slug === metadata.organization.slug &&
    session.user.email === metadata.user.email &&
    session.user.id === metadata.user.id &&
    session.user.imageUrl === metadata.user.imageUrl &&
    session.user.initials === metadata.user.initials &&
    session.user.username === metadata.user.username
  );
}

export async function syncNativeSessionProfile(
  input: SyncNativeSessionProfileInput = {}
): Promise<boolean> {
  const current = (input.getSession ?? getSession)();
  if (!current) {
    return false;
  }

  const client = input.client ?? createDesktopNativeAuthClient();
  const metadata = await client.session({
    accessToken: current.tokens.accessToken,
    organizationId: current.organization.id,
  });

  if (
    metadata.client !== "desktop" ||
    metadata.organization.id !== current.organization.id ||
    metadata.user.id !== current.user.id ||
    sessionMatchesMetadata(current, metadata)
  ) {
    return false;
  }

  return (input.setSession ?? setSession)({
    ...current,
    organization: metadata.organization,
    user: metadata.user,
  });
}
