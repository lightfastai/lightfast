interface StatusMessageProps {
  testResult: {
    success: boolean;
    message: string;
  } | null;
  onDismiss: () => void;
}

export function StatusMessage({ testResult, onDismiss }: StatusMessageProps) {
  if (!testResult) return null;

  return (
    <div
      className={`mb-4 rounded-md p-3 text-sm ${
        testResult.success
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      <div className="flex items-center">
        <div
          className={`mr-2 h-2 w-2 rounded-full ${testResult.success ? "bg-green-500" : "bg-red-500"}`}
        />
        <span>{testResult.message}</span>
        <button
          className="ml-auto text-xs opacity-70 hover:opacity-100"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
