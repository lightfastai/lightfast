import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { HubClerkProvider } from "./providers/clerk-provider";

export default function App() {
  useEffect(() => {
    syncThemeWithLocal();
  }, []);

  return (
    <HubClerkProvider>
      <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
        {/* <RouterProvider router={router} /> */}
        Yo
      </div>
    </HubClerkProvider>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
