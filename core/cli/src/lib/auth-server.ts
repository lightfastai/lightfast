import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

interface AuthResult {
  token: string;
  state: string;
}

/**
 * Starts a localhost HTTP server, waits for the Clerk JWT callback
 * from the /cli/auth page, then shuts down.
 */
export function startAuthServer(): Promise<{
  port: number;
  state: string;
  waitForToken: () => Promise<AuthResult>;
}> {
  return new Promise((resolve, reject) => {
    const state = randomBytes(24).toString("base64url");
    let resolveToken: ((result: AuthResult) => void) | undefined;
    const tokenPromise = new Promise<AuthResult>((res) => {
      resolveToken = res;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost`);

      if (url.pathname === "/callback") {
        const token = url.searchParams.get("token");
        const returnedState = url.searchParams.get("state");

        if (token && returnedState === state) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui">
              <div style="text-align:center">
                <h2>Authenticated</h2>
                <p>You can close this window and return to your terminal.</p>
              </div>
            </body></html>
          `);
          resolveToken?.({ token, state: returnedState });
          setTimeout(() => server.close(), 500);
        } else {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid callback parameters");
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind server"));
        return;
      }
      resolve({
        port: addr.port,
        state,
        waitForToken: () => tokenPromise,
      });
    });

    server.on("error", reject);
  });
}
