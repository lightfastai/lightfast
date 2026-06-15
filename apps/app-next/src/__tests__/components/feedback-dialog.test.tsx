import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitSentryFeedbackMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("~/sentry-feedback", () => ({
  FEEDBACK_MESSAGE_PLACEHOLDER:
    "Tell us what happened, what you expected, and any useful context.",
  submitSentryFeedback: submitSentryFeedbackMock,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

const { FeedbackDialog } = await import("~/components/feedback-dialog");

beforeEach(() => {
  submitSentryFeedbackMock.mockReset();
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

describe("FeedbackDialog", () => {
  it("submits trimmed feedback to Sentry and closes", async () => {
    const onOpenChange = vi.fn();
    submitSentryFeedbackMock.mockResolvedValue("feedback_event");

    render(<FeedbackDialog onOpenChange={onOpenChange} open />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  Ada Lovelace  " },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "  ada@example.com  " },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  The signals page failed to load.  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(submitSentryFeedbackMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        message: "The signals page failed to load.",
        name: "Ada Lovelace",
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Feedback sent", {
      description: "Thanks for helping us improve Lightfast.",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requires a description before submitting", async () => {
    render(<FeedbackDialog onOpenChange={vi.fn()} open />);

    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    expect(
      await screen.findByText("Add a description before sending feedback.")
    ).toBeInTheDocument();
    expect(submitSentryFeedbackMock).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows an error toast when submission fails", async () => {
    const onOpenChange = vi.fn();
    submitSentryFeedbackMock.mockRejectedValue(new Error("network down"));

    render(<FeedbackDialog onOpenChange={onOpenChange} open />);

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Something went sideways." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Unable to send feedback", {
        description: "Please try again or contact support.",
      });
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
