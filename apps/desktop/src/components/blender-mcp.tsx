import React, { useState } from "react";
import { useBlenderStore } from "@/stores/blender-store";

export const BlenderMCP: React.FC = () => {
  const [code, setCode] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const { connectionStatus, executeCode } = useBlenderStore();

  const handleExecute = async () => {
    if (!code.trim()) return;

    try {
      setOutput("Executing code...");
      await executeCode(code);
      setOutput("Code execution request sent to Blender");
    } catch (error) {
      setOutput(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Blender Code Execution</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm">Status:</span>
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              connectionStatus.status === "connected"
                ? "bg-green-500"
                : connectionStatus.status === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500"
            }`}
          />
          <span className="text-sm">{connectionStatus.status}</span>
        </div>
      </div>

      <textarea
        className="h-32 w-full rounded-md border p-2 font-mono text-sm"
        placeholder="Enter Blender Python code here..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <div className="flex justify-between">
        <button
          className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          onClick={handleExecute}
          disabled={connectionStatus.status !== "connected" || !code.trim()}
        >
          Execute Code
        </button>

        <button
          className="rounded-md border px-4 py-2 hover:bg-gray-100"
          onClick={() => setCode("")}
        >
          Clear
        </button>
      </div>

      {output && (
        <div className="mt-2 rounded-md bg-gray-100 p-2">
          <pre className="font-mono text-sm whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
};

export default BlenderMCP;
