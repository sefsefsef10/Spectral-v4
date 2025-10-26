import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';

export interface WebSocketEvent {
  type: 'alert_created' | 'alert_resolved' | 'compliance_updated' | 'vendor_status_changed' | 'system_status_changed' | 'connection_established' | 'pong';
  payload: any;
  timestamp: Date;
}

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
        console.log('WebSocket connected');
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
              console.log('WebSocket connection established:', data.payload);
              break;

            case 'pong':
              break;

            default:
              console.log('Unknown WebSocket event type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        options.onDisconnect?.();

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        if (options.autoReconnect !== false) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
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
