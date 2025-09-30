"use client";

import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";
import type { ChatStatus, FileUIPart, JSONValue } from "ai";
import {
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  PlusIcon,
  SendIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import {
  type ChangeEventHandler,
  Children,
  type ClipboardEventHandler,
  type ComponentProps,
  createContext,
  type FormEvent,
  type FormEventHandler,
  Fragment,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type PromptInputAttachmentItem = FileUIPart & {
  id: string;
  /**
   * Original File instance captured from the input element.
   * Undefined when the attachment comes from a non-File source.
   */
  file?: File;
  /**
   * Cached byte size to avoid re-reading the File in downstream consumers.
   */
  size?: number;
  /**
   * Storage path returned by the attachment service once persisted.
   */
  storagePath?: string;
  /**
   * Canonical content type returned by the attachment service.
   */
  contentType?: string;
  /**
   * Arbitrary metadata attached to the uploaded file.
   */
  metadata?: Record<string, JSONValue> | null;
  /**
   * Upload state - 'pending' while uploading, 'complete' when done
   */
  uploadState?: 'pending' | 'complete';
};

type AttachmentsContext = {
  files: PromptInputAttachmentItem[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: (options?: { revokeObjectURLs?: boolean }) => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
};

const AttachmentsContext = createContext<AttachmentsContext | null>(null);

const revokeObjectURL = (url?: string) => {
  if (!url || !url.startsWith("blob:")) {
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn("Failed to revoke object URL", { url, error });
  }
};

export const usePromptInputAttachments = () => {
  const context = useContext(AttachmentsContext);

  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput"
    );
  }

  return context;
};

export type PromptInputAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: PromptInputAttachmentItem;
  className?: string;
};

export function PromptInputAttachment({
  data,
  className,
  ...props
}: PromptInputAttachmentProps) {
  const attachments = usePromptInputAttachments();
  const isUploading = data.uploadState === 'pending';

  return (
    <div
      className={cn("group relative h-14 w-14 rounded-md border", className)}
      key={data.id}
      {...props}
    >
      {data.mediaType?.startsWith("image/") && data.url ? (
        <div className="relative size-full">
          <img
            alt={data.filename || "attachment"}
            className={cn(
              "size-full rounded-md object-cover",
              isUploading && "opacity-50"
            )}
            height={56}
            src={data.url}
            width={56}
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="size-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          {isUploading ? (
            <Loader2Icon className="size-5 animate-spin text-primary" />
          ) : (
            <PaperclipIcon className="size-4" />
          )}
        </div>
      )}
      <Button
        aria-label="Remove attachment"
        className="-right-1.5 -top-1.5 absolute h-6 w-6 rounded-full opacity-0 group-hover:opacity-100"
        onClick={() => attachments.remove(data.id)}
        size="icon"
        type="button"
        variant="outline"
        disabled={isUploading}
      >
        <XIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

export type PromptInputAttachmentsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (attachment: PromptInputAttachmentItem) => React.ReactNode;
};

export function PromptInputAttachments({
  className,
  children,
  ...props
}: PromptInputAttachmentsProps) {
  const attachments = usePromptInputAttachments();
  const [height, setHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(() => {
      setHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      aria-live="polite"
      className={cn(
        "overflow-hidden transition-[height] duration-200 ease-out",
        className
      )}
      style={{ height: attachments.files.length ? height : 0 }}
      {...props}
    >
      <div className="flex flex-wrap gap-2 p-3 pt-3" ref={contentRef}>
        {attachments.files.map((file) => (
          <Fragment key={file.id}>{children(file)}</Fragment>
        ))}
      </div>
    </div>
  );
}

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

export const PromptInputActionAddAttachments = ({
  label = "Add photos or files",
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const attachments = usePromptInputAttachments();

  return (
    <DropdownMenuItem
      {...props}
      onSelect={(e) => {
        e.preventDefault();
        attachments.openFileDialog();
      }}
    >
      <ImageIcon className="mr-2 size-4" /> {label}
    </DropdownMenuItem>
  );
};

export type PromptInputAttachmentPayload = {
  id: string;
  file?: File;
  url?: string;
  mediaType?: string;
  filename?: string;
  size?: number;
  storagePath?: string;
  contentType?: string;
  metadata?: Record<string, JSONValue> | null;
  uploadState?: 'pending' | 'complete';
};

export type PromptInputMessage = {
  text?: string;
  attachments?: PromptInputAttachmentPayload[];
};

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "onError"
> & {
  accept?: string; // e.g., "image/*" or leave undefined for any
  multiple?: boolean;
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean;
  // Render a hidden input with given name and keep it in sync for native form posts. Default false.
  syncHiddenInput?: boolean;
  // Minimal constraints
  maxFiles?: number;
  maxFileSize?: number; // bytes
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept" | "upload_failed";
    message: string;
  }) => void;
  onAttachmentUpload?: (
    file: File
  ) => Promise<PromptInputAttachmentItem | null | undefined>;
  onAttachmentsChange?: (attachments: PromptInputAttachmentItem[]) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void;
};

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onAttachmentUpload,
  onAttachmentsChange,
  onSubmit,
  ...props
}: PromptInputProps) => {
  const [items, setItems] = useState<PromptInputAttachmentItem[]>([]);
  const itemsRef = useRef<PromptInputAttachmentItem[]>(items);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Find nearest form to scope drag & drop
  useEffect(() => {
    const root = anchorRef.current?.closest("form");
    if (root instanceof HTMLFormElement) {
      formRef.current = root;
    }
  }, []);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === "") {
        return true;
      }
      // Simple check: if accept includes "image/*", filter to images; otherwise allow.
      if (accept.includes("image/*")) {
        return f.type.startsWith("image/");
      }
      return true;
    },
    [accept]
  );

  const add = useCallback(
    (files: File[] | FileList) => {
      void (async () => {
        const incoming = Array.from(files);
        const accepted = incoming.filter((f) => matchesAccept(f));
        if (accepted.length === 0) {
          onError?.({
            code: "accept",
            message: "No files match the accepted types.",
          });
          return;
        }

        const withinSize = (f: File) =>
          maxFileSize ? f.size <= maxFileSize : true;
        const sized = accepted.filter(withinSize);
        if (sized.length === 0 && accepted.length > 0) {
          onError?.({
            code: "max_file_size",
            message: "All files exceed the maximum size.",
          });
          return;
        }

        const currentLength = itemsRef.current.length;
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - currentLength)
            : undefined;
        const capped =
          typeof capacity === "number" ? sized.slice(0, capacity) : sized;

        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: "Too many files. Some were not added.",
          });
        }

        if (capped.length === 0) {
          return;
        }

        if (onAttachmentUpload) {
          // Create pending items immediately for visual feedback
          const pendingItems: PromptInputAttachmentItem[] = capped.map((file) => {
            const itemId = nanoid();
            // Create preview URL for images, empty string for others (required by FileUIPart)
            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

            return {
              id: itemId,
              type: "file",
              url: previewUrl,
              mediaType: file.type || "application/octet-stream",
              filename: file.name,
              file,
              size: file.size,
              uploadState: 'pending' as const,
            };
          });

          // Add pending items to UI immediately
          setItems((prev) => prev.concat(pendingItems));

          // Upload files and update items as they complete
          for (const pendingItem of pendingItems) {
            const file = pendingItem.file;
            if (!file) continue;

            try {
              const uploaded = await onAttachmentUpload(file);
              if (!uploaded) {
                // Remove the pending item if upload returned null/undefined
                setItems((prev) => prev.filter((item) => item.id !== pendingItem.id));
                revokeObjectURL(pendingItem.url);
                continue;
              }

              const mediaType =
                uploaded.mediaType ??
                uploaded.contentType ??
                file.type ??
                "application/octet-stream";
              const filename = uploaded.filename ?? file.name;
              const size = uploaded.size ?? file.size;
              const finalUrl = uploaded.url ?? pendingItem.url;

              // Update the pending item with completed upload data
              setItems((prev) =>
                prev.map((item) =>
                  item.id === pendingItem.id
                    ? {
                        ...uploaded,
                        type: "file",
                        id: pendingItem.id,
                        url: finalUrl,
                        mediaType,
                        filename,
                        size,
                        contentType: uploaded.contentType ?? mediaType,
                        uploadState: 'complete' as const,
                      }
                    : item
                )
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Failed to upload attachment.";
              onError?.({ code: "upload_failed", message });

              // Remove the failed pending item
              setItems((prev) => prev.filter((item) => item.id !== pendingItem.id));
              revokeObjectURL(pendingItem.url);
            }
          }

          return;
        }

        const next: PromptInputAttachmentItem[] = capped.map((file) => ({
          id: nanoid(),
          type: "file",
          url: URL.createObjectURL(file),
          mediaType: file.type || "application/octet-stream",
          filename: file.name,
          file,
          size: file.size,
        }));

        if (next.length > 0) {
          setItems((prev) => prev.concat(next));
        }
      })();
    },
    [matchesAccept, maxFiles, maxFileSize, onAttachmentUpload, onError]
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const found = prev.find((file) => file.id === id);
      revokeObjectURL(found?.url);
      return prev.filter((file) => file.id !== id);
    });
  }, []);

  const clear = useCallback(
    (options?: { revokeObjectURLs?: boolean }) => {
      const shouldRevoke = options?.revokeObjectURLs ?? true;
      setItems((prev) => {
        if (shouldRevoke) {
          for (const file of prev) {
            revokeObjectURL(file.url);
          }
        }
        return [];
      });
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [],
  );

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current) {
      // Clear the input when items are cleared
      if (items.length === 0) {
        inputRef.current.value = "";
      }
    }
  }, [items, syncHiddenInput]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    onAttachmentsChange?.(items);
  }, [items, onAttachmentsChange]);

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add]);

  useEffect(() => {
    if (!globalDrop) {
      return;
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files);
    }
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const attachmentsPayload: PromptInputAttachmentPayload[] = items.map(
      (item) => ({
        id: item.id,
        file: item.file,
        url: item.url,
        mediaType: item.mediaType,
        filename: item.filename,
        size: item.size,
        storagePath: item.storagePath,
        contentType: item.contentType,
        metadata: item.metadata ?? null,
        uploadState: item.uploadState,
      }),
    );

    onSubmit(
      {
        text: event.currentTarget.message.value,
        attachments: attachmentsPayload,
      },
      event,
    );

    clear();
  };

  const ctx = useMemo<AttachmentsContext>(
    () => ({
      files: items.map((item) => ({ ...item, id: item.id })),
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [items, add, remove, clear, openFileDialog]
  );

  return (
    <AttachmentsContext.Provider value={ctx}>
      <span aria-hidden="true" className="hidden" ref={anchorRef} />
      <input
        accept={accept}
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <form
        className={cn(
          "w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm",
          className
        )}
        onSubmit={handleSubmit}
        {...props}
      />
    </AttachmentsContext.Provider>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
  className,
  ...props
}: PromptInputBodyProps) => (
  <div className={cn(className, "flex flex-col")} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const attachments = usePromptInputAttachments();

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter") {
      // Don't submit if IME composition is in progress
      if (e.nativeEvent.isComposing) {
        return;
      }

      if (e.shiftKey) {
        // Allow newline
        return;
      }

      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;

    if (!items) {
      return;
    }

    const files: File[] = [];

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      attachments.add(files);
    }
  };

  return (
    <Textarea
      className={cn(
        "w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0",
        "field-sizing-content bg-transparent dark:bg-transparent",
        "max-h-48 min-h-16",
        "focus-visible:ring-0",
        className
      )}
      name="message"
      onChange={(e) => {
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputToolbar = ({
  className,
  ...props
}: PromptInputToolbarProps) => (
  <div
    className={cn("flex items-center justify-between p-1", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div
    className={cn(
      "flex items-center gap-1",
      "[&_button:first-child]:rounded-bl-xl",
      className
    )}
    {...props}
  />
);

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size = "sm",
  ...props
}: PromptInputButtonProps) => {
  return (
    <Button
      className={cn(
        "shrink-0 gap-1.5 rounded-full text-xs",
        "border-border/30 dark:border-border/50",
        variant === "ghost" && "text-muted-foreground",
        className
      )}
      size={size}
      type="button"
      variant={variant}
      {...props}
    />
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = ComponentProps<
  typeof Button
> & {};
export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton className={className} {...props}>
      {children ?? <PlusIcon className="size-4" />}
    </PromptInputButton>
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps) => (
  <DropdownMenuItem className={cn(className)} {...props} />
);

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <SendIcon className="size-4" />;

  if (status === "submitted") {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      className={cn("gap-1.5 rounded-lg", className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

export type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => (
  <Select {...props} />
);

export type PromptInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
      className
    )}
    {...props}
  />
);

export type PromptInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export const PromptInputModelSelectContent = ({
  className,
  ...props
}: PromptInputModelSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputModelSelectItem = ({
  className,
  ...props
}: PromptInputModelSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputModelSelectValueProps = ComponentProps<
  typeof SelectValue
>;

export const PromptInputModelSelectValue = ({
  className,
  ...props
}: PromptInputModelSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);
