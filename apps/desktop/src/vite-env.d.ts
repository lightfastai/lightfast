/// <reference types="vite/client" />

// Variables injected by vite-plugin-electron or @electron-forge/plugin-vite
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

interface ImportMetaEnv {
  readonly VITE_PUBLIC_LIGHTFAST_API_URL: string;
  readonly VITE_OPENAI_API_KEY: string;
  // Auth-specific variables
  readonly VITE_AUTH_APP_URL: string;
  readonly VITE_AUTH_APP_CLIENT_ID: string;
  readonly VITE_AUTH_APP_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
