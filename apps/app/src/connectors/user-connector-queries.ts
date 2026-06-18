import {
  disconnectUserConnector,
  startUserConnector,
} from "@api/app/tanstack/user-connectors";
import type { UserConnectorProvider } from "@lightfast/connector-core";
import { mutationOptions } from "@tanstack/react-query";

type StartUserConnectorResult = Awaited<ReturnType<typeof startUserConnector>>;

export function startUserConnectorMutationOptions(input?: {
  onSuccess?: (result: StartUserConnectorResult) => void;
}) {
  return mutationOptions({
    mutationFn: (data: { provider: UserConnectorProvider }) =>
      startUserConnector({ data }),
    onSuccess: input?.onSuccess,
  });
}

export function disconnectUserConnectorMutationOptions(input?: {
  onSuccess?: () => void;
}) {
  return mutationOptions({
    mutationFn: (data: { provider: UserConnectorProvider }) =>
      disconnectUserConnector({ data }),
    onSuccess: input?.onSuccess,
  });
}
