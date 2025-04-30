import React from "react";

export function App() {
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    // Test IPC communication
    window.electron.ping().then((response) => {
      setMessage(response);
    });
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Lightfast Desktop</h1>
        <p>IPC Test: {message}</p>
      </div>
    </div>
  );
}
