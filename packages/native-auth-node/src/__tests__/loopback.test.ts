import { request } from "node:http";
import { describe, expect, it } from "vitest";

import { NativeAuthError, startLoopbackServer } from "..";

function get(url: string): Promise<{ body: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const req = request(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ body, statusCode: res.statusCode ?? 0 });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

describe("@repo/native-auth-node loopback server", () => {
  it("captures callback code and state on an ephemeral loopback port", async () => {
    const server = await startLoopbackServer({
      expectedStateNonce: "nonce_1234567890",
      successHtmlTitle: "Lightfast Test",
    });

    try {
      const response = await get(
        `http://127.0.0.1:${server.port}/callback?code=code_123&state=${Buffer.from(
          JSON.stringify({
            attemptId: "attempt_123456789",
            nonce: "nonce_1234567890",
          })
        ).toString("base64url")}`
      );

      await expect(server.waitForCallback()).resolves.toMatchObject({
        code: "code_123",
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("Lightfast Test");
    } finally {
      await server.close();
    }
  });

  it("rejects OAuth callback errors", async () => {
    const server = await startLoopbackServer({
      expectedStateNonce: "nonce_1234567890",
      successHtmlTitle: "Lightfast Test",
    });

    try {
      const state = Buffer.from(
        JSON.stringify({
          attemptId: "attempt_123456789",
          nonce: "nonce_1234567890",
        })
      ).toString("base64url");
      const response = await get(
        `http://127.0.0.1:${server.port}/callback?error=access_denied&state=${state}`
      );

      await expect(server.waitForCallback()).rejects.toThrow(NativeAuthError);
      expect(response.statusCode).toBe(400);
    } finally {
      await server.close();
    }
  });
});
