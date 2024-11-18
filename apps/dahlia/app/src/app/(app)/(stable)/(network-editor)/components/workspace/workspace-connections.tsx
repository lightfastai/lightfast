import { createPath } from "~/components/path-utils";
import { CursorPosition } from "./types";

interface Connection {
  sourceId: string;
  sourcePos: { x: number; y: number };
  targetId: string;
  targetPos: { x: number; y: number };
}

interface ConnectionInProgress {
  sourceId: string;
  sourcePos: { x: number; y: number };
}

interface WorkspaceConnectionsProps {
  cursorPosition: CursorPosition;
  connections: Connection[];
  connectionInProgress?: ConnectionInProgress;
}

export function WorkspaceConnections({
  cursorPosition,
  connections,
  connectionInProgress,
}: WorkspaceConnectionsProps) {
  const { x, y } = cursorPosition;

  return (
    <>
      {/* Established connections */}
      <svg
        className="pointer-events-none fixed inset-0 h-canvas-grid w-canvas-grid"
        style={{ zIndex: 0 }}
      >
        {connections.map((connection) => (
          <path
            key={`${connection.sourceId}-${connection.targetId}`}
            d={createPath(
              connection.sourcePos.x,
              connection.sourcePos.y,
              connection.targetPos.x,
              connection.targetPos.y,
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          />
        ))}
      </svg>

      {/* Connection being created */}
      {connectionInProgress && (
        <svg
          className="pointer-events-none fixed inset-0 h-canvas-grid w-canvas-grid"
          style={{ zIndex: 0 }}
        >
          <path
            d={createPath(
              connectionInProgress.sourcePos.x,
              connectionInProgress.sourcePos.y,
              x,
              y,
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4"
          />
        </svg>
      )}
    </>
  );
}
