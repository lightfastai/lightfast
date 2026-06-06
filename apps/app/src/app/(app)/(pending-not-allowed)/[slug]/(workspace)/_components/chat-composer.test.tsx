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
          onWriteModeChange={vi.fn()}
          status="ready"
          stop={stop}
          text={text}
          writeModeEnabled={false}
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
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();

    resolveSubmit?.();
  });

  it("clears the prompt immediately when submitted with Enter", async () => {
    function Harness() {
      const [text, setText] = useState("Summarize my workspace");

      return (
        <ChatComposer
          compact={false}
          error={undefined}
          onSubmit={onSubmit}
          onTextChange={setText}
          onWriteModeChange={vi.fn()}
          status="ready"
          stop={stop}
          text={text}
          writeModeEnabled={false}
        />
      );
    }

    render(<Harness />);

    fireEvent.keyDown(screen.getByPlaceholderText("Ask Lightfield"), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        files: [],
        text: "Summarize my workspace",
      });
    });
    expect(screen.getByPlaceholderText("Ask Lightfield")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();

    resolveSubmit?.();
  });

  it("renders a write mode toggle and reports changes", () => {
    const onWriteModeChange = vi.fn();

    render(
      <ChatComposer
        compact={false}
        error={undefined}
        onSubmit={onSubmit}
        onTextChange={vi.fn()}
        onWriteModeChange={onWriteModeChange}
        status="ready"
        stop={stop}
        text=""
        writeModeEnabled={false}
      />
    );

    const toggle = screen.getByRole("button", { name: "Write mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(onWriteModeChange).toHaveBeenCalledWith(true);
  });
});
