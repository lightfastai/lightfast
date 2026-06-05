/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIGHTFAST_APP_URL: string;
  readonly VITE_LIGHTFAST_PLATFORM_URL: string;
  readonly VITE_LIGHTFAST_WWW_URL: string;
  readonly VITE_WWW_START_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
