/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIGHTFAST_APP_URL: string;
  readonly VITE_TANSTACK_EXAMPLE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly SERVICE_JWT_SECRET?: string;
    }
  }
}

export {};
