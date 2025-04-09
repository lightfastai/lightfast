import type { Connection } from "@xyflow/react";
import { useCallback, useState } from "react";

import { useConnectionValidation } from "./use-connection-validation";

export const useDynamicConnections = () => {
  const [lastValidationError, setLastValidationError] = useState<string | null>(
    null,
  );
  const { validateConnection } = useConnectionValidation();

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const result = validateConnection(connection);

      if (!result.valid) {
        setLastValidationError(result.error || "Invalid connection");
        return false;
      }

      setLastValidationError(null);
      return true;
    },
    [validateConnection],
  );

  return {
    isValidConnection,
    lastValidationError,
  };
};
