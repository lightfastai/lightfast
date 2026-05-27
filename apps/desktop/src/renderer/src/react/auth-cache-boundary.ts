import type { AuthSnapshot } from "../../../shared/ipc";

function authCacheBoundaryKey(snapshot: AuthSnapshot): string {
  return [
    snapshot.isSignedIn ? "signed-in" : "signed-out",
    snapshot.userEmail ?? "",
    snapshot.organizationId ?? "",
    snapshot.organizationSlug ?? "",
    snapshot.organizationName ?? "",
  ].join("\0");
}

export function hasAuthCacheBoundaryChanged(
  previous: AuthSnapshot,
  next: AuthSnapshot
): boolean {
  return authCacheBoundaryKey(previous) !== authCacheBoundaryKey(next);
}
