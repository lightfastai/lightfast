/// <reference types="vite/client" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly MCP_AUTH_ISSUER: string;
      readonly MCP_RESOURCE_URL: string;
      readonly SERVICE_JWT_SECRET: string;
    }
  }
}

export {};
