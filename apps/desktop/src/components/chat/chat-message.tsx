import type { Message } from "ai";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  // Helper function to render message parts
  const renderMessagePart = (part: any, partIndex: number) => {
    if (part.type === "text") {
      return part.text;
    }

    if (part.type === "tool-invocation") {
      const { toolCallId, toolName, args, state } = part;

      // Ensure args is stringifiable before proceeding
      let argsString = "[Non-stringifiable args]";
      try {
        argsString = JSON.stringify(args);
      } catch (e) {
        console.error("Could not stringify tool args:", args, e);
      }

      // Handle all possible tool states
      if (state === "call" || state === "calling") {
        return (
          <div
            key={`${message.id}-${toolCallId}-call-${partIndex}`}
            className="text-muted-foreground w-full py-2 text-center text-xs italic"
          >
            Calling tool: {toolName}({argsString})...
          </div>
        );
      }

      if (state === "result" || state === "success") {
        // Attempt to parse the result string for display
        let resultDisplay = part.result;
        try {
          if (typeof resultDisplay === "string") {
            resultDisplay = JSON.stringify(JSON.parse(resultDisplay), null, 2);
          }
        } catch (e) {
          /* Ignore parsing error, display as is */
        }
        return (
          <div
            key={`${message.id}-${toolCallId}-result-${partIndex}`}
            className="mt-2 mb-2 flex w-full justify-start"
          >
            <div
              className={`bg-muted text-foreground max-w-[80%] rounded-2xl border px-4 py-2.5 text-sm`}
            >
              <span className="font-semibold">Tool Result ({toolName}):</span>
              <pre className="mt-1 text-xs break-all whitespace-pre-wrap">
                {typeof resultDisplay === "string"
                  ? resultDisplay
                  : JSON.stringify(resultDisplay)}
              </pre>
            </div>
          </div>
        );
      }

      if (state === "error" || state === "failed") {
        // Check for specific error codes
        let errorMessage = String(part.error);
        let errorClass = "bg-destructive text-destructive-foreground";

        // Convert JSON string error to object if needed
        let errorObj = part.error;
        if (typeof part.error === "string") {
          try {
            errorObj = JSON.parse(part.error);
          } catch (e) {
            // Not JSON, leave as string
          }
        }

        // Check for specific error codes
        if (
          errorObj &&
          typeof errorObj === "object" &&
          "errorCode" in errorObj
        ) {
          if (errorObj.errorCode === "BLENDER_NOT_CONNECTED") {
            errorClass = "bg-amber-600 text-white";
            errorMessage =
              "⚠️ Blender is not connected. Please start Blender and connect it to the app.";
          }
        }

        return (
          <div
            key={`${message.id}-${toolCallId}-error-${partIndex}`}
            className="mt-2 mb-2 flex w-full justify-start"
          >
            <div
              className={`${errorClass} max-w-[80%] rounded-2xl border px-4 py-2.5 text-sm`}
            >
              <span className="font-semibold">Tool Error ({toolName}):</span>
              <pre className="mt-1 text-xs break-all whitespace-pre-wrap">
                {errorMessage}
              </pre>
            </div>
          </div>
        );
      }

      // Handle any other state
      return (
        <div
          key={`${message.id}-${toolCallId}-unknown-${partIndex}`}
          className="text-muted-foreground w-full py-2 text-center text-xs italic"
        >
          Tool {toolName} is in state: {state}
        </div>
      );
    }

    // Handle other part types if they exist
    return null;
  };

  return (
    <div>
      {Array.isArray(message.parts) && (
        <div>
          {/* Text content (if any) */}
          {message.parts.some((part) => part.type === "text") && (
            <div
              className={`mb-2 flex w-full ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  message.role === "user"
                    ? "text-primary-foreground bg-orange-500"
                    : "bg-muted text-foreground"
                }`}
              >
                {/* Combine all text parts */}
                {message.parts
                  .filter((part) => part.type === "text")
                  .map((part: any, idx) => (
                    <span key={idx}>{part.text}</span>
                  ))}
              </div>
            </div>
          )}

          {/* Tool invocation parts */}
          {message.parts
            .filter((part) => part.type === "tool-invocation")
            .map((part: any, idx) => renderMessagePart(part, idx))}
        </div>
      )}
    </div>
  );
}
