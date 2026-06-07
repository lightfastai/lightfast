import { describe, expect, it } from "vitest";
import { isPreallocatedConversationId } from "~/chat/conversation-id";

describe("workspace assistant conversation ids", () => {
  it("recognizes preallocated UUID conversation ids", () => {
    expect(
      isPreallocatedConversationId("conv_ff83026e-ef0e-40db-ae59-544fbe4df209")
    ).toBe(true);
  });

  it("rejects non-preallocated conversation ids", () => {
    expect(isPreallocatedConversationId("conv_123")).toBe(false);
    expect(
      isPreallocatedConversationId("msg_ff83026e-ef0e-40db-ae59-544fbe4df209")
    ).toBe(false);
  });
});
