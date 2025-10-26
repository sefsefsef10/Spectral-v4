import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { parse as parseCookie } from 'cookie';
import { logger } from '../../logger';
import { sessionStore } from '../../index';

export interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  healthSystemId?: string;
  vendorId?: string;
  role: 'health_system' | 'vendor' | 'admin';
  isAlive: boolean;
}

export interface BroadcastEvent {
  type: 'alert_created' | 'alert_resolved' | 'compliance_updated' | 'vendor_status_changed' | 'system_status_changed';
  payload: any;
  timestamp: Date;
}

class SpectralWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<AuthenticatedWebSocket> = new Set();

  initialize(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    logger.info('WebSocket server initialized on /ws');

    this.wss.on('connection', async (ws: WebSocket, req) => {
      try {
        const authenticated = await this.authenticateConnection(ws, req);
        if (!authenticated) {
          ws.close(1008, 'Authentication failed');
          return;
        }

        const authWs = ws as AuthenticatedWebSocket;
        authWs.isAlive = true;
        this.clients.add(authWs);

        logger.info({ 
          userId: authWs.userId, 
          role: authWs.role,
          clientCount: this.clients.size 
        }, 'WebSocket client connected');

        authWs.on('pong', () => {
          authWs.isAlive = true;
        });

        authWs.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(authWs, message);
          } catch (error) {
            logger.error({ err: error }, 'Error parsing WebSocket message');
          }
        });

        authWs.on('close', () => {
          this.clients.delete(authWs);
          logger.info({ 
            userId: authWs.userId,
            clientCount: this.clients.size 
          }, 'WebSocket client disconnected');
        });

        authWs.on('error', (error) => {
          logger.error({ err: error, userId: authWs.userId }, 'WebSocket error');
          this.clients.delete(authWs);
        });

        authWs.send(JSON.stringify({
          type: 'connection_established',
          payload: { userId: authWs.userId, role: authWs.role },
          timestamp: new Date(),
        }));
      } catch (error) {
        logger.error({ err: error }, 'Error handling WebSocket connection');
        ws.close(1011, 'Internal server error');
      }
    });

    this.startHeartbeat();
  }

  private async authenticateConnection(ws: WebSocket, req: any): Promise<boolean> {
    try {
      const cookies = req.headers.cookie;
      if (!cookies) {
        logger.warn('WebSocket connection attempted without cookies');
        return false;
      }

      const parsedCookies = parseCookie(cookies);
      const sessionId = parsedCookies['spectral.sid'];
      
      if (!sessionId) {
        logger.warn('WebSocket connection attempted without session cookie');
        return false;
      }

      const sessionIdDecoded = decodeURIComponent(sessionId.split('.')[0].substring(2));

      return new Promise((resolve) => {
        sessionStore.get(sessionIdDecoded, (err, session) => {
          if (err || !session || !session.userId) {
            logger.warn({ err }, 'Invalid session for WebSocket connection');
            resolve(false);
            return;
          }

          const authWs = ws as AuthenticatedWebSocket;
          authWs.userId = session.userId;
          authWs.role = session.role || 'health_system';
          authWs.healthSystemId = session.healthSystemId;
          authWs.vendorId = session.vendorId;

          resolve(true);
        });
      });
    } catch (error) {
      logger.error({ err: error }, 'Error authenticating WebSocket connection');
      return false;
    }
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: any) {
    logger.debug({ userId: ws.userId, message }, 'Received WebSocket message');

    if (message.type === 'ping') {
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date(),
      }));
    }
  }

  private startHeartbeat() {
    const interval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.info({ userId: ws.userId }, 'Terminating inactive WebSocket connection');
          this.clients.delete(ws);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss?.on('close', () => {
      clearInterval(interval);
    });
  }

  broadcast(event: BroadcastEvent, filter?: (ws: AuthenticatedWebSocket) => boolean) {
    const message = JSON.stringify(event);
    let sentCount = 0;

    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (!filter || filter(ws)) {
          ws.send(message);
          sentCount++;
        }
      }
    });

    logger.debug({ 
      eventType: event.type, 
      sentCount,
      totalClients: this.clients.size 
    }, 'Broadcast event to WebSocket clients');
  }

  broadcastToHealthSystem(healthSystemId: string, event: BroadcastEvent) {
    this.broadcast(event, (ws) => ws.healthSystemId === healthSystemId);
  }

  broadcastToVendor(vendorId: string, event: BroadcastEvent) {
    this.broadcast(event, (ws) => ws.vendorId === vendorId);
  }

  broadcastToUser(userId: string, event: BroadcastEvent) {
    this.broadcast(event, (ws) => ws.userId === userId);
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const websocketServer = new SpectralWebSocketServer();
