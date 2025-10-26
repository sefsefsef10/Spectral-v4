import { logger } from '../../logger';
import type { BroadcastEvent } from './websocket-server';

let websocketServer: any = null;

export async function initializeWebSocketBroadcaster() {
  try {
    const module = await import('./websocket-server');
    websocketServer = module.websocketServer;
    logger.info('WebSocket broadcaster initialized');
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize WebSocket broadcaster');
  }
}

export function broadcastAlertCreated(alertId: string, healthSystemId: string, payload: any) {
  if (!websocketServer) return;
  
  const event: BroadcastEvent = {
    type: 'alert_created',
    payload: { alertId, ...payload },
    timestamp: new Date(),
  };
  
  websocketServer.broadcastToHealthSystem(healthSystemId, event);
  logger.debug({ alertId, healthSystemId }, 'Broadcast alert_created event');
}

export function broadcastAlertResolved(alertId: string, healthSystemId: string, payload: any) {
  if (!websocketServer) return;
  
  const event: BroadcastEvent = {
    type: 'alert_resolved',
    payload: { alertId, ...payload },
    timestamp: new Date(),
  };
  
  websocketServer.broadcastToHealthSystem(healthSystemId, event);
  logger.debug({ alertId, healthSystemId }, 'Broadcast alert_resolved event');
}

export function broadcastComplianceUpdated(systemId: string, healthSystemId: string, payload: any) {
  if (!websocketServer) return;
  
  const event: BroadcastEvent = {
    type: 'compliance_updated',
    payload: { systemId, ...payload },
    timestamp: new Date(),
  };
  
  websocketServer.broadcastToHealthSystem(healthSystemId, event);
  logger.debug({ systemId, healthSystemId }, 'Broadcast compliance_updated event');
}

export function broadcastSystemStatusChanged(systemId: string, healthSystemId: string, payload: any) {
  if (!websocketServer) return;
  
  const event: BroadcastEvent = {
    type: 'system_status_changed',
    payload: { systemId, ...payload },
    timestamp: new Date(),
  };
  
  websocketServer.broadcastToHealthSystem(healthSystemId, event);
  logger.debug({ systemId, healthSystemId }, 'Broadcast system_status_changed event');
}

export function broadcastVendorStatusChanged(vendorId: string, payload: any) {
  if (!websocketServer) return;
  
  const event: BroadcastEvent = {
    type: 'vendor_status_changed',
    payload: { vendorId, ...payload },
    timestamp: new Date(),
  };
  
  websocketServer.broadcastToVendor(vendorId, event);
  logger.debug({ vendorId }, 'Broadcast vendor_status_changed event');
}
