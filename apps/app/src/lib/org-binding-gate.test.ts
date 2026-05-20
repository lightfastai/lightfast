import { beforeEach, describe, expect, it, vi } from "vitest";

const isOrgBoundMock = vi.fn();

// `org-binding-gate.ts` imports `db` from `@db/app/client` (eager Neon client +
// DB-env validation) and `isOrgBound` from `@db/app`. Stub both — the gate's
// only job is to reduce the authoritative DB binding to the route-layer
// `bound | unbound` binary, so the DB call itself is out of scope here.
vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: isOrgBoundMock }));

const { getOrgBindingGate } = await import("./org-binding-gate");

beforeEach(() => {
  isOrgBoundMock.mockReset();
});

describe("getOrgBindingGate", () => {
  it("returns bindingStatus 'bound' when the org has an active binding", async () => {
    isOrgBoundMock.mockResolvedValueOnce(true);

    await expect(getOrgBindingGate("org_bound")).resolves.toEqual({
      bindingStatus: "bound",
    });
  });

  it("returns bindingStatus 'unbound' when the org has no active binding", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);

    await expect(getOrgBindingGate("org_unbound")).resolves.toEqual({
      bindingStatus: "unbound",
    });
  });

  it("queries the authoritative binding for the supplied Clerk org id", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);

    await getOrgBindingGate("org_xyz");

    expect(isOrgBoundMock).toHaveBeenCalledWith(expect.anything(), "org_xyz");
  });
});
