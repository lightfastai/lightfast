import { useMatch, useParams } from "@tanstack/react-router";

/**
 * Custom hook to get the current workspace ID
 *
 * - Attempts to use TanStack Router's useParams when in the proper route context
 * - Falls back to regex extraction from window.location.pathname
 * - Handles edge cases and errors gracefully
 *
 * @returns The current workspace ID or an empty string if none is found
 */
export function useCurrentWorkspaceId(): string {
  // Wrap in a try-catch to handle any potential router context errors
  try {
    // Check if we're currently on a workspace route
    const match = useMatch({ from: "/workspace/$workspaceId" });

    if (match) {
      // If we have a match, we can safely use useParams
      const params = useParams({ from: "/workspace/$workspaceId" });
      if (params.workspaceId) {
        return params.workspaceId;
      }
    }
  } catch (error) {
    // Silently handle any router-related errors
    // This ensures the hook doesn't break the app if used outside a router context
    console.debug(
      "Router params not available, falling back to URL extraction",
    );
  }

  // Fall back to regex extraction from window.location
  return window.location.pathname.match(/\/workspace\/([^/]+)/)?.[1] || "";
}

/**
 * Get the workspace ID synchronously (without hooks)
 * Useful for callbacks and effects that need the latest workspace ID
 *
 * @returns The current workspace ID from the URL or an empty string
 */
export function getCurrentWorkspaceId(): string {
  return window.location.pathname.match(/\/workspace\/([^/]+)/)?.[1] || "";
}
