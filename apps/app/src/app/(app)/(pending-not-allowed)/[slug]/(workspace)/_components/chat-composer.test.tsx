import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./chat-composer";

describe("ChatComposer", () => {
  let resolveSubmit: (() => void) | undefined;
  const onSubmit = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      })
  );
  const stop = vi.fn();

  beforeEach(() => {
    onSubmit.mockClear();
    stop.mockClear();
    resolveSubmit = undefined;
  });

  it("clears the prompt immediately while keeping the submit control disabled", async () => {
    function Harness() {
      const [text, setText] = useState("Summarize my workspace");

      return (
        <ChatComposer
          compact={false}
          error={undefined}
          onSubmit={onSubmit}
          onTextChange={setText}
          status="ready"
          stop={stop}
          text={text}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        files: [],
        text: "Summarize my workspace",
      });
    });
    expect(screen.getByPlaceholderText("Ask Lightfield")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Stop generating" })
    ).toBeDisabled();

    resolveSubmit?.();
  });
});
