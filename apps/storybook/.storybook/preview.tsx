import type { Preview } from "@storybook/react-vite";
import "@fontsource-variable/geist";
import { initialize, mswLoader } from "msw-storybook-addon";
import "@repo/ui-v2/globals.css";
import { TooltipProvider } from "@repo/ui-v2/components/ui/tooltip";
import { mswHandlers } from "./msw-handlers";

initialize({ onUnhandledRequest: "bypass" });

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Desktop theme",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === "light" ? "light" : "dark";

      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.dataset.platform = "darwin";
        document.documentElement.dataset.windowKind = "primary";
        document.documentElement.dataset.buildFlavor = "dev";
        document.body.classList.add("bg-background", "text-foreground");
      }

      return (
        <TooltipProvider>
          <div className="min-h-screen bg-background p-6 font-sans text-foreground">
            <Story />
          </div>
        </TooltipProvider>
      );
    },
  ],
  loaders: [mswLoader],
  parameters: {
    a11y: {
      test: "todo",
    },
    backgrounds: {
      disable: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
    msw: {
      handlers: mswHandlers,
    },
  },
  async beforeEach() {
    localStorage.setItem("lightfast-desktop:sidebar-collapsed", "false");
  },
};

export default preview;
