import {
  BlenderConnectionStatus,
  useBlenderStore,
} from "@/stores/blender-store";

import { InfoCard } from "@repo/ui/components/info-card";

const getStatusInfo = (
  status: BlenderConnectionStatus,
): { color: string; title: string } => {
  switch (status.status) {
    case "connected":
      return { color: "bg-green-500", title: "Blender Connected" };
    case "listening":
      return {
        color: "bg-yellow-500",
        title: "Waiting for Blender connection...",
      };
    case "disconnected":
      return { color: "bg-gray-500", title: "Blender Disconnected" };
    case "stopped":
      return { color: "bg-gray-500", title: "Connection Stopped" };
    case "error":
      return {
        color: "bg-red-500",
        title: `Connection Error: ${status.error || "Unknown"}`,
      };
    default:
      return { color: "bg-gray-300", title: "Unknown Status" };
  }
};

export function BlenderStatusIndicator() {
  const connectionStatus = useBlenderStore((state) => state.connectionStatus);

  // Don't render anything until the listener might have received an initial status
  // or if the initial state is 'stopped' and we want it hidden initially.
  // Adjust this logic based on desired initial visibility.
  // if (connectionStatus.status === 'stopped') {
  //   return null;
  // }

  const { color, title } = getStatusInfo(connectionStatus);

  return (
    <InfoCard
      title="Blender Status"
      items={[{ label: "Status", value: title }]}
    />
  );
}
