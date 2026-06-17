import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputStart,
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
  it("provides stable CSS-first start and footer slots", () => {
    const onSubmit = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputStart>
          <button type="button">Add context</button>
        </PromptInputStart>
        <PromptInputTextarea placeholder="Ask" />
        <PromptInputFooter>
          <button type="button">Write mode</button>
          <button type="submit">Send</button>
        </PromptInputFooter>
      </PromptInput>
    );

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Ask");
    const promptInput = textarea.closest("form");
    const inputGroup = promptInput?.querySelector('[data-slot="input-group"]');
    const start = promptInput?.querySelector(
      '[data-slot="prompt-input-start"]'
    );
    const footer = promptInput?.querySelector(
      '[data-slot="prompt-input-footer"]'
    );

    expect(inputGroup?.className).toContain(
      "grid-cols-[auto_minmax(0,1fr)_auto]"
    );
    expect(inputGroup?.className).toContain("h-auto");
    expect(inputGroup?.className).not.toContain("h-9");
    expect(inputGroup?.className).toContain("items-stretch");
    expect(inputGroup?.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:items-center"
    );
    expect(inputGroup?.className).not.toContain("group-data-[multiline=");
    expect(inputGroup?.className).toContain(
      "has-[[data-slot=input-group-control]:focus-visible]:ring-0"
    );
    expect(inputGroup?.className).not.toContain(
      "has-[[data-slot=input-group-control]:focus-visible]:ring-1"
    );
    expect(promptInput?.className).toContain("rounded-[1.75rem]");
    expect(promptInput?.className).toContain(
      "has-[textarea:placeholder-shown]:rounded-full"
    );
    expect(promptInput?.className).not.toContain("data-[multiline=");
    expect(promptInput?.hasAttribute("data-multiline")).toBe(false);
    expect(textarea.className).toContain("field-sizing-content");
    expect(textarea.className).toContain("min-h-0");
    expect(textarea.className).toContain("order-1");
    expect(textarea.className).toContain("col-span-3");
    expect(textarea.className).toContain("col-start-1");
    expect(textarea.className).toContain("px-5");
    expect(textarea.className).toContain("pt-5");
    expect(textarea.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:order-2"
    );
    expect(textarea.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:col-span-1"
    );
    expect(textarea.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:col-start-2"
    );
    expect(textarea.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:py-3"
    );
    expect(textarea.className).not.toContain("group-data-[multiline=");
    expect(start?.getAttribute("data-align")).toBe("inline-start");
    expect(start?.className).toContain("order-2");
    expect(start?.className).toContain("col-start-1");
    expect(start?.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:order-1"
    );
    expect(start?.className).not.toContain("group-data-[multiline=");
    expect(footer?.getAttribute("data-align")).toBe("inline-end");
    expect(footer?.className).toContain("order-2");
    expect(footer?.className).toContain("col-start-2");
    expect(footer?.className).toContain("col-end-4");
    expect(footer?.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:order-3"
    );
    expect(footer?.className).toContain(
      "group-has-[textarea:placeholder-shown]/prompt-input:col-start-3"
    );
    expect(footer?.className).not.toContain("group-data-[multiline=");
  });

  it("keeps header, body, and action slots in native grid order", () => {
    const onSubmit = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputHeader>Attached context</PromptInputHeader>
        <PromptInputStart>
          <button type="button">Add context</button>
        </PromptInputStart>
        <PromptInputTextarea placeholder="Ask" />
        <PromptInputFooter>
          <button type="submit">Send</button>
        </PromptInputFooter>
      </PromptInput>
    );

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Ask");
    const promptInput = textarea.closest("form");
    const header = promptInput?.querySelector(
      '[data-slot="prompt-input-header"]'
    );
    const start = promptInput?.querySelector(
      '[data-slot="prompt-input-start"]'
    );
    const footer = promptInput?.querySelector(
      '[data-slot="prompt-input-footer"]'
    );

    expect(header?.className).toContain("col-span-3");
    expect(header?.className).toContain("col-start-1");
    expect(header?.className).toContain("order-0");
    expect(header?.className).not.toContain("group-data-[multiline=");
    expect(textarea.className).toContain("order-1");
    expect(textarea.className).toContain("col-span-3");
    expect(textarea.className).not.toContain("group-data-[multiline=");
    expect(start?.className).toContain("order-2");
    expect(start?.className).not.toContain("group-data-[multiline=");
    expect(footer?.className).toContain("order-2");
    expect(footer?.className).not.toContain("group-data-[multiline=");
  });

  it("keeps layout state stable while textarea content grows and shrinks", () => {
    const onSubmit = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea placeholder="Ask" />
        <button type="submit">Send</button>
      </PromptInput>
    );

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Ask");
    const promptInput = textarea.closest("form");

    expect(promptInput?.hasAttribute("data-multiline")).toBe(false);

    fireEvent.change(textarea, {
      target: { value: "First line\nSecond line" },
    });

    expect(promptInput?.hasAttribute("data-multiline")).toBe(false);

    fireEvent.change(textarea, {
      target: { value: "Single line again" },
    });

    expect(promptInput?.hasAttribute("data-multiline")).toBe(false);
  });

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
