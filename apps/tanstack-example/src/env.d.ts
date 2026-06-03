/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIGHTFAST_APP_URL: string;
  readonly VITE_TANSTACK_EXAMPLE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
