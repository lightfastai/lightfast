import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  PromptInput,
  PromptInputProvider,
  PromptInputTextarea,
} from "./prompt-input";

function ControlledPrompt({
  onSubmit,
}: {
  onSubmit: Parameters<typeof PromptInput>[0]["onSubmit"];
}) {
  const [text, setText] = useState("");

  return (
    <PromptInputProvider>
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder="Ask"
          value={text}
        />
        <button disabled={text.trim().length === 0} type="submit">
          Send
        </button>
      </PromptInput>
    </PromptInputProvider>
  );
}

describe("PromptInputTextarea", () => {
  it("respects externally controlled text when a PromptInputProvider is present", async () => {
    const onSubmit = vi.fn();

    render(<ControlledPrompt onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Ask");
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: "Send",
    });

    expect(submit.disabled).toBe(true);

    fireEvent.change(textarea, {
      target: { value: "Send this message" },
    });

    expect(submit.disabled).toBe(false);

    fireEvent.click(submit);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { files: [], text: "Send this message" },
        expect.any(Object)
      )
    );
  });

  it("keeps provider control when onChange only observes text", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <PromptInputProvider>
        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea onChange={onChange} placeholder="Ask" />
          <button type="submit">Send</button>
        </PromptInput>
      </PromptInputProvider>
    );

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Ask");

    fireEvent.change(textarea, {
      target: { value: "Send this message" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { files: [], text: "Send this message" },
        expect.any(Object)
      )
    );
    expect(onChange).toHaveBeenCalled();
    expect(textarea.value).toBe("");
  });
});
