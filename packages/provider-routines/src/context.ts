import type { Database, OrgConnectorConnection } from "@db/app";
import type { ProviderRoutineSourceSurface } from "@repo/provider-routine-contract";

export interface ProviderRoutineServiceLog {
  error(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

export interface ProviderRoutineActor {
  orgId: string;
  userId: string;
}

export interface ProviderRoutineSource {
  clientId?: string | null;
  ref?: string | null;
  surface: ProviderRoutineSourceSurface;
}

export interface LinearProviderRoutineAdapter {
  callTool(input: {
    accessToken: string;
    connection: OrgConnectorConnection;
    input: Record<string, unknown>;
    providerToolName: string;
  }): Promise<unknown>;
  getAccessToken(input: {
    connection: OrgConnectorConnection;
    db: Database;
    log: ProviderRoutineServiceLog;
    now: () => Date;
  }): Promise<string>;
}

export interface ProviderRoutineServiceAdapters {
  linear?: LinearProviderRoutineAdapter;
}

export interface ProviderRoutineServiceContext {
  actor: ProviderRoutineActor;
  adapters?: ProviderRoutineServiceAdapters;
  db: Database;
  log: ProviderRoutineServiceLog;
  now: () => Date;
  scopes: {
    providerRoutineRead: boolean;
    providerRoutineWrite: boolean;
  };
  source: ProviderRoutineSource;
}
