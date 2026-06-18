import { createUnkeyClient } from "@vendor/unkey/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("vendor Unkey server client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to Unkey with manual redirects and bearer auth", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        meta: { requestId: "req_test" },
        data: { code: "NOT_FOUND", valid: false },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createUnkeyClient("root_test");

    await client.keys.verifyKey({ key: "lf_test" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall!;
    expect(String(url)).toBe("https://api.unkey.com/v2/keys.verifyKey");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "manual",
    });
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer root_test"
    );
  });

  it("rejects redirects instead of following them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        })
      )
    );

    const client = createUnkeyClient("root_test");

    await expect(client.keys.verifyKey({ key: "lf_test" })).rejects.toMatchObject({
      statusCode: 302,
    });
  });
});
