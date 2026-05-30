import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignalDetailContent } from "./signal-detail-content";
import type { SignalDetailRow, SignalListItem } from "./signals-model";

const headerItem: SignalListItem = {
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    priority: "high",
    summary: "Customer wants migration help.",
    title: "Follow up on migration",
  },
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  id: 7,
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  status: "classified",
};

const detail: SignalDetailRow = {
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
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 7,
  input: "Customer asked for migration help",
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  status: "classified",
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
} as SignalDetailRow;

describe("SignalDetailContent", () => {
  it("renders the header from the projection seed immediately", () => {
    render(
      <SignalDetailContent
        bodyLoading={true}
        item={headerItem}
        onCopyLink={vi.fn()}
      />
    );

    expect(screen.getByText("SIG-7")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Follow up on migration" })
    ).toBeInTheDocument();
    expect(screen.getByText("Follow up")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(
      screen.getByTestId("signal-detail-body-skeleton")
    ).toBeInTheDocument();
  });

  it("renders the body from the full detail row", () => {
    render(
      <SignalDetailContent
        bodyLoading={false}
        detail={detail}
        item={headerItem}
        onCopyLink={vi.fn()}
      />
    );

    expect(
      screen.getByText("Customer asked for migration help")
    ).toBeInTheDocument();
    expect(screen.getByText("Reply with migration plan")).toBeInTheDocument();
    expect(
      screen.getByText("The customer is asking for help.")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("signal-detail-body-skeleton")
    ).not.toBeInTheDocument();
  });

  it("renders the error section for a failed detail row", () => {
    render(
      <SignalDetailContent
        bodyLoading={false}
        detail={
          {
            ...detail,
            classification: null,
            errorCode: "CLASSIFY_FAILED",
            errorMessage: "Model timed out",
            status: "failed",
          } as SignalDetailRow
        }
        item={{ ...headerItem, classification: null, status: "failed" }}
        onCopyLink={vi.fn()}
      />
    );

    expect(screen.getByText("CLASSIFY_FAILED")).toBeInTheDocument();
    expect(screen.getByText("Model timed out")).toBeInTheDocument();
  });

  it("invokes onCopyLink when the copy-link button is clicked", () => {
    const onCopyLink = vi.fn();
    render(
      <SignalDetailContent
        bodyLoading={false}
        detail={detail}
        item={headerItem}
        onCopyLink={onCopyLink}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });
});
