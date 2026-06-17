import { handleNativeRpcRequest } from "./native-rpc";

const cliNativeRpcCommands = ["auth.session"] as const;

export function handleCliNativeRpcRequest(request: Request) {
  return handleNativeRpcRequest(request, {
    allowedCommands: cliNativeRpcCommands,
    source: "cli",
  });
}
