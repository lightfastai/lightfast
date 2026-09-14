import { MessageAction } from "@repo/ui/components/ai-elements/message";
import { PromptInputButton } from "@repo/ui/components/ai-elements/prompt-input";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

interface ButtonCase {
  disabled: boolean;
  kind: "prompt" | "message";
  tooltip: "none" | "string" | "object";
}

const cases: ButtonCase[] = [
  { kind: "prompt", tooltip: "none", disabled: false },
  { kind: "prompt", tooltip: "string", disabled: false },
  { kind: "prompt", tooltip: "object", disabled: false },
  { kind: "message", tooltip: "none", disabled: false },
  { kind: "message", tooltip: "string", disabled: false },
  { kind: "prompt", tooltip: "none", disabled: true },
  { kind: "prompt", tooltip: "string", disabled: true },
  { kind: "message", tooltip: "none", disabled: true },
  { kind: "message", tooltip: "string", disabled: true },
];

const caseName = (item: ButtonCase) =>
  `${item.kind}-${item.tooltip}-${item.disabled ? "disabled" : "enabled"}`;

function ButtonExample({ item }: { item: ButtonCase }) {
  const [clicks, setClicks] = useState(0);
  const [submissions, setSubmissions] = useState(0);
  const name = caseName(item);
  const tip = item.tooltip === "none" ? undefined : `Help for ${name}`;
  const props = {
    className: "composition-button",
    disabled: item.disabled,
    onClick: () => setClicks((count) => count + 1),
  };

  return (
    <form
      className="flex items-center gap-3"
      data-testid={name}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmissions((count) => count + 1);
      }}
    >
      {item.kind === "prompt" ? (
        <PromptInputButton
          {...props}
          aria-label={name}
          tooltip={
            item.tooltip === "object"
              ? { content: tip, shortcut: "Ctrl K", side: "bottom" }
              : tip
          }
        >
          <span aria-hidden="true">+</span>
        </PromptInputButton>
      ) : (
        <MessageAction {...props} label={name} tooltip={tip}>
          <span aria-hidden="true">+</span>
        </MessageAction>
      )}
      <span>{name}</span>
      <output data-testid="clicks">{clicks}</output>
      <output data-testid="submissions">{submissions}</output>
    </form>
  );
}

const meta = {
  title: "ai-elements/Button composition",
  render: () => (
    <div className="grid gap-3">
      {cases.map((item) => (
        <ButtonExample item={item} key={caseName(item)} />
      ))}
    </div>
  ),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Focus: Story = {};

export const Regression: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const item of cases) {
      const name = caseName(item);
      const form = canvas.getByTestId(name);
      const row = within(form);
      await expect(form.querySelectorAll("button")).toHaveLength(1);
      const button = row.getByRole("button", { name });
      await expect(button).toHaveAttribute("type", "button");
      await expect(button).toHaveClass("composition-button");
      await expect(row.getByTestId("clicks")).toHaveTextContent("0");
      if (item.disabled) {
        await expect(button).toBeDisabled();
        if (item.tooltip !== "none") {
          await expect(button.parentElement?.tagName).toBe("SPAN");
          await expect(button.parentElement).toHaveAttribute("tabindex", "0");
          await userEvent.click(button.parentElement!);
        }
      }
      await userEvent.click(button, { pointerEventsCheck: 0 });
      await expect(row.getByTestId("clicks")).toHaveTextContent(
        item.disabled ? "0" : "1"
      );
      await expect(row.getByTestId("submissions")).toHaveTextContent("0");
    }
    canvasElement.dataset.compositionVerified = "passed";
  },
};
