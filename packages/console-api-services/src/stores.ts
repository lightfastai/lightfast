import type { Store } from "@db/console/schema";
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
		workspaceId: string;
		storeName: string;
		embeddingDim?: number;
	}): Promise<Store> {
		return this.call("stores.getOrCreate", async (caller) =>
			caller.stores.getOrCreate(params),
		);
	}

	/**
	 * Get a store by name
	 */
	async getByName(storeName: string): Promise<Store> {
		return this.call("stores.getByName", async (caller) =>
			caller.stores.getByName({ storeName }),
		);
	}

	/**
	 * List all stores for a workspace
	 */
	async listByWorkspace(workspaceId: string): Promise<Store[]> {
		return this.call("stores.listByWorkspace", async (caller) =>
			caller.stores.listByWorkspace({ workspaceId }),
		);
	}
}
