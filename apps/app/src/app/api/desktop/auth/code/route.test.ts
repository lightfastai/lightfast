import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyCliJwtMock = vi.fn<(req: Request) => Promise<{ userId: string } | null>>();
vi.mock("../../../cli/lib/verify-jwt", () => ({
  verifyCliJwt: (req: Request) => verifyCliJwtMock(req),
}));

const issueCodeMock = vi.fn<(record: unknown) => Promise<string>>();
vi.mock("../lib/code-store", () => ({
  issueCode: (record: unknown) => issueCodeMock(record),
}));

const { POST } = await import("./route");

const VALID_BODY = {
  state: "a".repeat(32),
  code_challenge: "b".repeat(43),
  code_challenge_method: "S256",
  redirect_uri: "lightfast-dev://auth/callback",
};

function makeReq(body: unknown, init?: RequestInit): Request {
  return new Request("http://localhost/api/desktop/auth/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer fake-jwt",
      ...(init?.headers as Record<string, string> | undefined),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

describe("POST /api/desktop/auth/code", () => {
  beforeEach(() => {
    verifyCliJwtMock.mockReset();
    issueCodeMock.mockReset();
    issueCodeMock.mockResolvedValue("issued-code");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when verifyCliJwt returns null", async () => {
    verifyCliJwtMock.mockResolvedValue(null);

    const res = await POST(makeReq(VALID_BODY));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(issueCodeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body fails schema (missing fields)", async () => {
    verifyCliJwtMock.mockResolvedValue({ userId: "user_123" });

    const res = await POST(makeReq({ state: "x" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
    expect(issueCodeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when redirect_uri is not in the allowlist", async () => {
    verifyCliJwtMock.mockResolvedValue({ userId: "user_123" });

    const res = await POST(
      makeReq({ ...VALID_BODY, redirect_uri: "https://evil.com/callback" })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
    expect(issueCodeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when code_challenge_method is not S256", async () => {
    verifyCliJwtMock.mockResolvedValue({ userId: "user_123" });

    const res = await POST(
      makeReq({ ...VALID_BODY, code_challenge_method: "plain" })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  it("returns 400 when body is not valid JSON", async () => {
    verifyCliJwtMock.mockResolvedValue({ userId: "user_123" });

    const res = await POST(makeReq("not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  it("issues a code and returns it on happy path with lightfast:// redirect", async () => {
    verifyCliJwtMock.mockResolvedValue({ userId: "user_123" });

    const res = await POST(
      makeReq({ ...VALID_BODY, redirect_uri: "lightfast://auth/callback" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "issued-code" });
    expect(issueCodeMock).toHaveBeenCalledTimes(1);
    expect(issueCodeMock).toHaveBeenCalledWith({
      userId: "user_123",
      jwt: "fake-jwt",
      state: VALID_BODY.state,
      codeChallenge: VALID_BODY.code_challenge,
      redirectUri: "lightfast://auth/callback",
    });
  });

  it("strips Bearer prefix case-insensitively when storing the JWT", async () => {
    verifyCliJwtMock.mockResolvedValue({ userId: "user_456" });

    await POST(
      new Request("http://localhost/api/desktop/auth/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "bearer alt-jwt",
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(issueCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ jwt: "alt-jwt" })
    );
  });
});
