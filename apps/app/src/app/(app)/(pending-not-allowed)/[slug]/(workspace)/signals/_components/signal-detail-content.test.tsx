import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignalDetailContent } from "./signal-detail-content";
import type { SignalRow } from "./signals-model";

const classifiedSignal: SignalRow = {
  id: 7,
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  input: "Customer asked for migration help",
  status: "classified",
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    nextAction: "Reply with migration plan",
    priority: "high",
    rationale: "The customer is asking for help.",
    summary: "Customer wants migration help.",
    title: "Follow up on migration",
  },
  errorCode: null,
  errorMessage: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
} as SignalRow;

function makeSignal(overrides: Partial<SignalRow>): SignalRow {
  return { ...classifiedSignal, ...overrides } as SignalRow;
}

describe("SignalDetailContent", () => {
  it("renders the identifier, title, classification properties, and body for a classified signal", () => {
    render(
      <SignalDetailContent onCopyLink={vi.fn()} signal={classifiedSignal} />
    );

    expect(screen.getByText("SIG-7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Follow up on migration" })
    ).toBeInTheDocument();
    expect(screen.getByText("Follow up")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("Classified")).toBeInTheDocument();
    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(
      screen.getByText("Customer asked for migration help")
    ).toBeInTheDocument();
    expect(screen.getByText("Customer wants migration help.")).toBeInTheDocument();
    expect(screen.getByText("Reply with migration plan")).toBeInTheDocument();
    expect(
      screen.getByText("The customer is asking for help.")
    ).toBeInTheDocument();
  });

  it("shows a User source when there is no API key", () => {
    render(
      <SignalDetailContent
        onCopyLink={vi.fn()}
        signal={makeSignal({ createdByApiKeyId: null })}
      />
    );
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("hides classification-only rows when the signal is not yet classified", () => {
    render(
      <SignalDetailContent
        onCopyLink={vi.fn()}
        signal={makeSignal({ classification: null, status: "processing" })}
      />
    );

    expect(screen.queryByText("Disposition")).not.toBeInTheDocument();
    expect(screen.queryByText("Confidence")).not.toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    // Title falls back to the raw input, so it appears in both the heading
    // and the Input body section.
    expect(
      screen.getByRole("heading", { name: "Customer asked for migration help" })
    ).toBeInTheDocument();
  });

  it("renders the error section for a failed signal", () => {
    render(
      <SignalDetailContent
        onCopyLink={vi.fn()}
        signal={makeSignal({
          classification: null,
          status: "failed",
          errorCode: "CLASSIFY_FAILED",
          errorMessage: "Model timed out",
        })}
      />
    );

    expect(screen.getByText("CLASSIFY_FAILED")).toBeInTheDocument();
    expect(screen.getByText("Model timed out")).toBeInTheDocument();
  });

  it("invokes onCopyLink when the copy-link button is clicked", () => {
    const onCopyLink = vi.fn();
    render(
      <SignalDetailContent onCopyLink={onCopyLink} signal={classifiedSignal} />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });
});
