import { handleNativeRpcRequest } from "./native-rpc";

const desktopNativeRpcCommands = ["auth.session"] as const;

export function handleDesktopNativeRpcRequest(request: Request) {
  return handleNativeRpcRequest(request, {
    allowedCommands: desktopNativeRpcCommands,
    source: "desktop",
  });
}
