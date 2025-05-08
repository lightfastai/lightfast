import React from "react";
import App from "@/App";
import { EnvProvider } from "@/providers/env-provider";
import { createRoot } from "react-dom/client";

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <EnvProvider>
      <App network="blender" />
    </EnvProvider>
  </React.StrictMode>,
);
