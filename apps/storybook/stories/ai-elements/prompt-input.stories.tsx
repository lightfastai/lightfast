import {
  AiBrain02Icon,
  Attachment02Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@repo/ui-v2/components/ai-elements/prompt-input";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";

const models = [
  { id: "lightfast/default", name: "Lightfast Default" },
  { id: "lightfast/research", name: "Research" },
  { id: "lightfast/code", name: "Code" },
];

const getModelName = (id: unknown) =>
  models.find((option) => option.id === id)?.name ?? String(id ?? "");

type PromptStatus = ComponentProps<typeof PromptInputSubmit>["status"];

function AttachmentPreview() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {attachments.files.map((file) => (
        <button
          className="flex items-center gap-1 rounded-xl bg-muted px-2 py-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          key={file.id}
          onClick={() => attachments.remove(file.id)}
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5"
            icon={Attachment02Icon}
          />
          <span>{file.filename ?? "Attachment"}</span>
        </button>
      ))}
    </div>
  );
}

function AddSampleAttachmentButton() {
  const attachments = usePromptInputAttachments();

  return (
    <PromptInputButton
      onClick={() =>
        attachments.add([
          new File(["Agent trace summary"], "trace-summary.txt", {
            type: "text/plain",
          }),
        ])
      }
      tooltip="Add sample attachment"
    >
      <HugeiconsIcon aria-hidden="true" icon={Attachment02Icon} />
    </PromptInputButton>
  );
}

function PromptInputSubmitControl({
  status,
  text,
}: {
  status: PromptStatus;
  text: string;
}) {
  const attachments = usePromptInputAttachments();
  const isBusy = status === "submitted" || status === "streaming";
  const isEmpty = text.trim().length === 0 && attachments.files.length === 0;

  return <PromptInputSubmit disabled={!isBusy && isEmpty} status={status} />;
}

function PromptInputStory({
  initialStatus = "ready",
}: {
  initialStatus?: PromptStatus;
}) {
  const [model, setModel] = useState(models[0]?.id ?? "");
  const [status, setStatus] = useState<PromptStatus>(initialStatus);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<PromptInputMessage | null>(null);

  return (
    <div className="grid w-[640px] gap-3">
      <PromptInput
        accept="image/*,text/plain"
        globalDrop
        maxFiles={3}
        multiple
        onSubmit={(message) => {
          const hasText = message.text.trim().length > 0;
          const hasAttachments = message.files.length > 0;

          if (!(hasText || hasAttachments)) {
            return;
          }

          setSubmitted(message);
          setStatus("submitted");
          setText("");
          window.setTimeout(() => setStatus("ready"), 900);
        }}
      >
        <PromptInputHeader>
          <AttachmentPreview />
        </PromptInputHeader>
        <PromptInputBody>
          <PromptInputTextarea
            onChange={(event) => setText(event.currentTarget.value)}
            placeholder="Ask Lightfast to inspect this run..."
            value={text}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
                <PromptInputActionAddScreenshot />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <AddSampleAttachmentButton />
            <PromptInputButton tooltip={{ content: "Search context" }}>
              <HugeiconsIcon aria-hidden="true" icon={Search02Icon} />
              <span>Search</span>
            </PromptInputButton>
            <PromptInputSelect
              onValueChange={(value) => setModel(String(value))}
              value={model}
            >
              <PromptInputSelectTrigger>
                <PromptInputSelectValue>{getModelName}</PromptInputSelectValue>
              </PromptInputSelectTrigger>
              <PromptInputSelectContent>
                {models.map((option) => (
                  <PromptInputSelectItem
                    key={option.id}
                    label={option.name}
                    value={option.id}
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={AiBrain02Icon}
                      size={16}
                    />
                    {option.name}
                  </PromptInputSelectItem>
                ))}
              </PromptInputSelectContent>
            </PromptInputSelect>
          </PromptInputTools>
          <PromptInputSubmitControl status={status} text={text} />
        </PromptInputFooter>
      </PromptInput>
      {submitted ? (
        <p className="text-muted-foreground text-xs">
          Last submitted: {submitted.text || "Attachment-only prompt"} with{" "}
          {submitted.files.length} file(s).
        </p>
      ) : null}
    </div>
  );
}

/**
 * Provides the prompt input composition from AI Elements.
 */
const meta = {
  title: "ai-elements/PromptInput",
  component: PromptInput,
  tags: ["autodocs"],
  args: {
    onSubmit: () => undefined,
  },
  render: () => <PromptInputStory />,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof PromptInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Streaming: Story = {
  render: () => <PromptInputStory initialStatus="streaming" />,
};

export const ErrorState: Story = {
  name: "Error",
  render: () => <PromptInputStory initialStatus="error" />,
};
