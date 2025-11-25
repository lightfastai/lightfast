import type { WorkspaceStore } from "@db/console/schema";
import { DeusApiService } from "./base-service";

/**
 * StoresService - tRPC wrapper for store management
 *
 * Provides a clean API for Pinecone store operations by wrapping
 * the stores tRPC router. All business logic is in api/console.
 */
export class StoresService extends DeusApiService {
	/**
	 * Get or create a store for a workspace
	 *
	 * Auto-provisions Pinecone index if store doesn't exist.
	 */
	async getOrCreateStore(params: {
		clerkOrgSlug: string;
		workspaceName: string;
		storeSlug: string;
		embeddingDim?: number;
	}): Promise<WorkspaceStore> {
		return this.call("stores.getOrCreate", async (caller) =>
			caller.stores.getOrCreate(params),
		);
	}

	/**
	 * Get a store by name
	 */
	async getByName(params: {
		clerkOrgSlug: string;
		workspaceName: string;
		storeSlug: string;
	}): Promise<WorkspaceStore> {
		return this.call("stores.getByName", async (caller) =>
			caller.stores.getByName(params),
		);
	}

	/**
	 * List all stores for a workspace
	 */
	async listByWorkspace(params: {
		clerkOrgSlug: string;
		workspaceName: string;
	}): Promise<WorkspaceStore[]> {
		return this.call("stores.listByWorkspace", async (caller) =>
			caller.stores.listByWorkspace(params),
		);
	}
}
