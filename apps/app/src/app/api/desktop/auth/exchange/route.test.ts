import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CodeRecord } from "../lib/code-store";

const consumeCodeMock = vi.fn<(code: string) => Promise<CodeRecord | null>>();
vi.mock("../lib/code-store", () => ({
  consumeCode: (code: string) => consumeCodeMock(code),
}));

const { POST } = await import("./route");

const VERIFIER = "v".repeat(64);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const CODE = "c".repeat(43);

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/desktop/auth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const goodRecord: CodeRecord = {
  userId: "user_123",
  jwt: "real-jwt",
  state: "s".repeat(32),
  codeChallenge: CHALLENGE,
  redirectUri: "lightfast-dev://auth/callback",
};

describe("POST /api/desktop/auth/exchange", () => {
  beforeEach(() => {
    consumeCodeMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 bad_request on schema failure", async () => {
    const res = await POST(makeReq({ code: "short" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
    expect(consumeCodeMock).not.toHaveBeenCalled();
  });

  it("returns 400 bad_request when body is not valid JSON", async () => {
    const res = await POST(makeReq("not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  it("returns 400 invalid_code when consumeCode returns null (expired/missing)", async () => {
    consumeCodeMock.mockResolvedValue(null);

    const res = await POST(makeReq({ code: CODE, code_verifier: VERIFIER }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_code" });
    expect(consumeCodeMock).toHaveBeenCalledWith(CODE);
  });

  it("returns 400 invalid_verifier when SHA256(verifier) != stored challenge", async () => {
    consumeCodeMock.mockResolvedValue(goodRecord);

    const tampered = "x".repeat(64);
    const res = await POST(
      makeReq({ code: CODE, code_verifier: tampered })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_verifier" });
  });

  it("returns 200 + token on happy path", async () => {
    consumeCodeMock.mockResolvedValue(goodRecord);

    const res = await POST(makeReq({ code: CODE, code_verifier: VERIFIER }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "real-jwt" });
  });

  it("consumes the code exactly once even when called twice with the same code", async () => {
    consumeCodeMock
      .mockResolvedValueOnce(goodRecord)
      .mockResolvedValueOnce(null);

    const first = await POST(makeReq({ code: CODE, code_verifier: VERIFIER }));
    const second = await POST(makeReq({ code: CODE, code_verifier: VERIFIER }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({ error: "invalid_code" });
  });
});
