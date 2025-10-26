import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';

interface AlertPayload {
  id: string;
  aiSystemId: string;
  type: string;
  severity: string;
  message: string;
}

interface CompliancePayload {
  aiSystemId: string;
  controlId: string;
  status: string;
}

interface StatusPayload {
  id: string;
  status: string;
}

export type WebSocketEvent =
  | { type: 'alert_created'; payload: AlertPayload; timestamp: Date }
  | { type: 'alert_resolved'; payload: { id: string }; timestamp: Date }
  | { type: 'compliance_updated'; payload: CompliancePayload; timestamp: Date }
  | { type: 'vendor_status_changed'; payload: StatusPayload; timestamp: Date }
  | { type: 'system_status_changed'; payload: StatusPayload; timestamp: Date }
  | { type: 'connection_established'; payload: Record<string, never>; timestamp: Date }
  | { type: 'pong'; payload: Record<string, never>; timestamp: Date };

export interface UseWebSocketOptions {
  onMessage?: (event: WebSocketEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        options.onConnect?.();

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          setLastEvent(data);
          options.onMessage?.(data);

          switch (data.type) {
            case 'alert_created':
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              queryClient.invalidateQueries({ queryKey: ['/api/predictive-alerts'] });
              break;

            case 'alert_resolved':
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              queryClient.invalidateQueries({ queryKey: ['/api/predictive-alerts'] });
              break;

            case 'compliance_updated':
              queryClient.invalidateQueries({ queryKey: ['/api/compliance'] });
              queryClient.invalidateQueries({ queryKey: ['/api/compliance-mappings'] });
              break;

            case 'system_status_changed':
              queryClient.invalidateQueries({ queryKey: ['/api/ai-systems'] });
              break;

            case 'vendor_status_changed':
              queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
              break;

            case 'connection_established':
              break;

            case 'pong':
              break;

            default:
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        setIsConnected(false);
        options.onDisconnect?.();

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        if (options.autoReconnect !== false) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [user, options, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    connect,
    disconnect,
  };
}
