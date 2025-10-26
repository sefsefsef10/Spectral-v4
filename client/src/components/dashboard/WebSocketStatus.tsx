import { useWebSocket } from "@/hooks/use-websocket";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

export function WebSocketStatus() {
  const { isConnected } = useWebSocket();

  return (
    <Badge
      variant={isConnected ? "default" : "secondary"}
      className="gap-1 text-xs"
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          Real-time
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </Badge>
  );
}
