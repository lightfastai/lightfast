import type { Connection } from "@xyflow/react";
import { useCallback } from "react";

import { nanoid } from "@repo/lib";
import { toast } from "@repo/ui/hooks/use-toast";

import type { BaseEdge } from "../types/node";
import { api } from "~/trpc/client/react";
import { useEdgeStore } from "../providers/edge-store-provider";
import { useNodeStore } from "../providers/node-store-provider";
import { useReplaceEdge } from "./use-replace-edge";
import { useEdgeValidation } from "./use-validate-edge";

export const useAddEdge = () => {
  const { addEdge, deleteEdge, edges } = useEdgeStore((state) => state);
  const { nodes } = useNodeStore((state) => state);
  const { mutateAsync: replaceEdgeMutate } = useReplaceEdge();
  const { mutateAsync: mut } = api.tenant.edge.create.useMutation({
    onMutate: (newEdge) => {
      const optimisticEdge: BaseEdge = {
        id: newEdge.id,
        source: newEdge.edge.source,
        target: newEdge.edge.target,
        sourceHandle: newEdge.edge.sourceHandle,
        targetHandle: newEdge.edge.targetHandle,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addEdge(optimisticEdge);

      return { optimisticEdge };
    },
    onError: (err, _newEdge, context) => {
      if (!context) return;
      deleteEdge(context.optimisticEdge.id);
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to add edge",
      });
    },
  });

  const {
    validateSelfConnection,
    validateTargetExistence,
    validateMaxIncomingEdges,
    validateWindowNode,
  } = useEdgeValidation();

  /**
   * Create a regular edge connection
   */
  const createRegularConnection = useCallback(
    async (connection: Connection) => {
      try {
        await mut({
          id: nanoid(),
          edge: {
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? "",
            targetHandle: connection.targetHandle ?? "",
          },
        });
      } catch (error) {
        console.error("Error creating edge:", error);
      }
    },
    [mut],
  );

  /**
   * Handle connection for texture nodes
   */
  const handleTextureConnection = useCallback(
    async (params: Connection) => {
      // Use the default handle if none specified
      const targetHandle = params.targetHandle ?? "input-1";

      // Update connection params with the target handle
      const connectionParams = {
        ...params,
        targetHandle,
      };

      // Check if there's an existing connection to this handle
      const existingEdge = edges.find(
        (edge) =>
          edge.target === params.target && edge.targetHandle === targetHandle,
      );

      if (existingEdge) {
        // Replace the existing connection to this handle
        return await replaceEdgeMutate(existingEdge.id, connectionParams);
      } else {
        // Add a new edge
        return await createRegularConnection(connectionParams);
      }
    },
    [createRegularConnection, edges, replaceEdgeMutate],
  );

  /**
   * Main function to handle edge connections with special handling for texture nodes
   */
  const mutateAsync = useCallback(
    async (connection: Connection) => {
      const { source, target } = connection;

      // Perform shared validations
      if (
        !validateSelfConnection(source, target) ||
        !validateTargetExistence(target) ||
        !validateMaxIncomingEdges(target) ||
        !validateWindowNode(target)
      ) {
        return;
      }

      // Find the target node to determine its type
      const targetNode = nodes.find((node) => node.id === target);
      if (!targetNode) return;

      // Special handling for texture nodes
      if (targetNode.type === "texture") {
        return handleTextureConnection(connection);
      }

      // Handle non-texture node connections
      const existingEdge = edges.find((edge) => edge.target === target);
      if (existingEdge) {
        // For non-texture nodes, replace the existing edge (maintains single-input behavior)
        return await replaceEdgeMutate(existingEdge.id, connection);
      } else {
        // Add a new edge
        return await createRegularConnection(connection);
      }
    },
    [
      validateSelfConnection,
      validateTargetExistence,
      validateMaxIncomingEdges,
      validateWindowNode,
      nodes,
      edges,
      handleTextureConnection,
      replaceEdgeMutate,
      createRegularConnection,
    ],
  );

  return { mutateAsync };
};
