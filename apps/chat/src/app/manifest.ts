import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lightfast Chat - Open-Source Model Agnostic AI Chat Interface",
    short_name: "Lightfast Chat",
    description: "Open-source AI chat interface that works with any model. Connect to GPT, Claude, Gemini, Llama and more through one unified interface.",
    start_url: "/",
    display: "standalone", 
    background_color: "#09090b",
    theme_color: "#09090b",
    lang: "en-US",
    categories: ["productivity", "business", "developer"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    orientation: "any",
    scope: "/",
    prefer_related_applications: false,
    display_override: ["window-controls-overlay", "standalone"],
  };
}