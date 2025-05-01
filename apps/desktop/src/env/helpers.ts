import type { EnvClient } from "./client-types";

// Module-level cache for the fetched client environment
let cachedClientEnv: EnvClient | null = null;
let fetchPromise: Promise<EnvClient | null> | null = null;

/**
 * Fetches the client environment variables from the main process via IPC.
 * Caches the result to avoid repeated calls.
 * @returns Promise resolving to the client environment object or null if fetch fails.
 */
async function fetchClientEnv(): Promise<EnvClient | null> {
  // If already cached, return it
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  // If a fetch is already in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }

  // Start a new fetch
  fetchPromise = new Promise(async (resolve) => {
    try {
      if (window.electronAPI?.getClientEnv) {
        console.log("env/helpers: Fetching client environment...");
        const envData = await window.electronAPI.getClientEnv();
        cachedClientEnv = envData;
        console.log(
          "env/helpers: Client environment fetched and cached.",
          envData,
        );
        resolve(cachedClientEnv);
      } else {
        console.error(
          "env/helpers: window.electronAPI or getClientEnv not found.",
        );
        resolve(null);
      }
    } catch (error) {
      console.error("env/helpers: Error fetching clientEnv:", error);
      resolve(null);
    } finally {
      // Clear the promise reference once fetch is complete (success or fail)
      fetchPromise = null;
    }
  });

  return fetchPromise;
}

/**
 * Gets the Lightfast API URL from the client environment variables.
 * Fetches the environment if not already cached.
 * @returns Promise resolving to the API URL string or null if not available.
 */
export async function getLightfastApiUrl(): Promise<string | null> {
  const clientEnv = await fetchClientEnv();
  return clientEnv?.VITE_PUBLIC_LIGHTFAST_API_URL ?? null;
}

// Add more specific getter functions as needed
// export async function getSomeOtherEnvVar(): Promise<boolean | null> {
//   const clientEnv = await fetchClientEnv();
//   return clientEnv?.VITE_PUBLIC_SOME_OTHER_VAR ?? null;
// }

/**
 * Pre-fetches and caches the client environment variables.
 * Call this early in your application initialization if needed.
 */
export function prefetchClientEnv(): void {
  fetchClientEnv();
}
