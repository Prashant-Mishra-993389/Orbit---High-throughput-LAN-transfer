import { WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { ControlMessage } from '@sharelan/protocol';
import { transferManager } from '../transfers/TransferManager.js';
import { getNetworkDiagnostics } from '../diagnostics/network.js';
import { config } from '../config/index.js';

export class WebSocketHub {
  private clients = new Set<WebSocket>();

  constructor() {
    this.setupTransferEvents();
  }

  public registerClient(socket: WebSocket): void {
    this.clients.add(socket);

    // Send initial snapshot on connect
    const diag = getNetworkDiagnostics(config.port);
    this.send(socket, {
      type: 'network:diagnostics',
      payload: diag,
    });

    // Send currently active transfers
    const sessions = transferManager.getAllSessions();
    for (const session of sessions) {
      this.send(socket, {
        type: 'transfer:created',
        payload: session,
      });
    }

    // Handle bidirectional client messages
    socket.on('message', (data: Buffer | string) => {
      try {
        const text = typeof data === 'string' ? data : data.toString();
        const msg = JSON.parse(text) as ControlMessage;

        // Process known actions
        switch (msg.type) {
          case 'transfer:accept': {
            transferManager.markAccepted(msg.payload.transferId, {
              receiverDeviceId: msg.payload.receiverDeviceId,
              receiverDeviceName: msg.payload.receiverDeviceName,
              receiverClientId: msg.payload.receiverClientId,
            });
            this.broadcast({
              type: 'transfer:accepted',
              payload: msg.payload,
            });
            break;
          }
          case 'transfer:reject': {
            transferManager.markRejected(msg.payload.transferId, msg.payload.reason);
            this.broadcast(msg);
            break;
          }
          default:
            // Broadcast client-originated control messages to peers
            this.broadcast(msg);
            break;
        }
      } catch (err) {
        console.warn('Failed to parse incoming WebSocket message:', err);
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      this.clients.delete(socket);
    });
  }

  public broadcast(message: ControlMessage): void {
    const raw = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  private send(socket: WebSocket, message: ControlMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private setupTransferEvents(): void {
    transferManager.on('transfer:created', (session) => {
      this.broadcast({ type: 'transfer:created', payload: session });
    });

    transferManager.on('transfer:state_change', (payload) => {
      this.broadcast({ type: 'transfer:state_change', payload });
    });

    transferManager.on('transfer:progress', (payload) => {
      this.broadcast({ type: 'transfer:progress', payload });
    });

    transferManager.on('transfer:completed', (payload) => {
      this.broadcast({
        type: 'transfer:completed',
        payload: {
          transferId: payload.transferId,
          finalHash: payload.finalHash,
          fileName: payload.fileName,
          bytesTransferred: payload.bytesTransferred,
        },
      });
    });

    transferManager.on('transfer:failed', (payload) => {
      this.broadcast({
        type: 'transfer:state_change',
        payload: { transferId: payload.transferId, status: 'FAILED', error: payload.error },
      });
    });

    transferManager.on('transfer:cancelled', (payload) => {
      this.broadcast({
        type: 'transfer:state_change',
        payload: { transferId: payload.transferId, status: 'CANCELLED' },
      });
    });
  }
}

export const wsHub = new WebSocketHub();

export async function registerWebSocketRoutes(server: FastifyInstance): Promise<void> {
  server.get('/ws', { websocket: true }, (socket) => {
    wsHub.registerClient(socket);
  });
}
