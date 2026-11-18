import { PassThrough, Readable } from 'node:stream';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { FastifyReply } from 'fastify';
import { TransferStatus } from '@sharelan/protocol';
import { transferManager } from './TransferManager.js';

export interface RelaySessionInfo {
  sessionId: string;
  transferId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  senderClientId: string;
  receiverClientId?: string;
  createdAt: number;
  expiresAt: number;
  status: TransferStatus;
  bytesRelayed: number;
}

interface ActiveRelayBridge {
  session: RelaySessionInfo;
  passThrough: PassThrough;
  hasher: crypto.Hash;
  senderConnected: boolean;
  receiverConnected: boolean;
  receiverReply?: FastifyReply;
  onReceiverReady?: () => void;
  onSenderReady?: () => void;
  lastActivity: number;
}

export class RelayBridgeManager extends EventEmitter {
  private activeBridges = new Map<string, ActiveRelayBridge>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    super();
    // Run cleanup for abandoned sessions every 30 seconds
    this.cleanupTimer = setInterval(() => {
      this.cleanupAbandoned();
    }, 30000);
    this.cleanupTimer.unref();
  }

  /**
   * Register a new relay session with a 10-minute TTL.
   * Zero disk allocation — strictly in-memory PassThrough stream.
   */
  public createSession(params: {
    sessionId?: string;
    transferId: string;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    senderClientId: string;
    receiverClientId?: string;
    ttlMs?: number;
  }): RelaySessionInfo {
    const sessionId = params.sessionId || params.transferId || crypto.randomUUID();
    const ttl = params.ttlMs || 10 * 60 * 1000; // 10 minutes
    const now = Date.now();

    // 64 KiB buffer for strict backpressure and bounded memory
    const passThrough = new PassThrough({
      highWaterMark: 64 * 1024,
    });

    passThrough.on('error', (err) => {
      console.debug(`[RelayBridge] Handled passThrough error for ${params.transferId}: ${err.message}`);
    });

    const session: RelaySessionInfo = {
      sessionId,
      transferId: params.transferId,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType || 'application/octet-stream',
      senderClientId: params.senderClientId,
      receiverClientId: params.receiverClientId,
      createdAt: now,
      expiresAt: now + ttl,
      status: 'OFFERED',
      bytesRelayed: 0,
    };

    const bridge: ActiveRelayBridge = {
      session,
      passThrough,
      hasher: crypto.createHash('sha256'),
      senderConnected: false,
      receiverConnected: false,
      lastActivity: now,
    };

    this.activeBridges.set(sessionId, bridge);
    return session;
  }

  public getSession(sessionId: string): RelaySessionInfo | undefined {
    const bridge = this.activeBridges.get(sessionId);
    return bridge?.session;
  }

  /**
   * Sender pushes live streaming chunks into the relay.
   * Chunks are forwarded immediately to the recipient response without touching disk.
   */
  public async handleSenderStream(
    sessionId: string,
    inputStream: Readable
  ): Promise<{ bytesRelayed: number; finalHash: string }> {
    const bridge = this.activeBridges.get(sessionId);
    if (!bridge) {
      throw new Error(`Relay session ${sessionId} not found or expired`);
    }

    bridge.senderConnected = true;
    bridge.session.status = 'TRANSFERRING';
    bridge.lastActivity = Date.now();
    transferManager.startTransferring(bridge.session.transferId);

    // If receiver is not yet connected, wait up to 120 seconds for receiver to connect
    if (!bridge.receiverConnected) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for receiver to connect to relay stream (120s limit)'));
        }, 120000);

        bridge.onReceiverReady = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;

      const onBridgeTerminated = (err?: Error) => {
        if (isSettled) return;
        isSettled = true;
        const error = err || new Error('Receiver disconnected or relay cancelled');
        try {
          if (!inputStream.destroyed) {
            inputStream.destroy();
          }
        } catch {}
        bridge.session.status = 'FAILED';
        transferManager.markFailed(bridge.session.transferId, error.message);
        this.activeBridges.delete(sessionId);
        reject(error);
      };

      bridge.passThrough.once('error', onBridgeTerminated);
      bridge.passThrough.once('close', () => {
        if (!inputStream.readableEnded && !isSettled) {
          onBridgeTerminated();
        }
      });

      inputStream.on('data', (chunk: Buffer) => {
        if (isSettled || bridge.passThrough.destroyed) {
          onBridgeTerminated();
          return;
        }

        bridge.session.bytesRelayed += chunk.length;
        bridge.hasher.update(chunk);
        bridge.lastActivity = Date.now();

        // Update centralized TransferManager so WebSocket clients get synchronized live progress
        transferManager.recordStreamBytes(bridge.session.transferId, bridge.session.bytesRelayed);

        this.emit('progress', {
          sessionId,
          transferId: bridge.session.transferId,
          bytesRelayed: bridge.session.bytesRelayed,
          totalBytes: bridge.session.fileSize,
        });

        // Push directly to receiver via bounded PassThrough with backpressure
        const canContinue = bridge.passThrough.write(chunk);
        if (!canContinue) {
          inputStream.pause();
          bridge.passThrough.once('drain', () => {
            if (!bridge.passThrough.destroyed && !isSettled) {
              inputStream.resume();
            } else {
              onBridgeTerminated();
            }
          });
        }
      });

      inputStream.on('end', () => {
        if (isSettled) return;
        isSettled = true;
        bridge.passThrough.end();
        bridge.session.status = 'COMPLETED';
        const finalHash = bridge.hasher.digest('hex');

        transferManager.markCompleted(bridge.session.transferId, finalHash);

        this.emit('completed', {
          sessionId,
          transferId: bridge.session.transferId,
          bytesRelayed: bridge.session.bytesRelayed,
          finalHash,
        });

        // Keep session metadata briefly then cleanup
        setTimeout(() => {
          this.activeBridges.delete(sessionId);
        }, 5000);

        resolve({
          bytesRelayed: bridge.session.bytesRelayed,
          finalHash,
        });
      });

      inputStream.on('close', () => {
        if (!inputStream.readableEnded && bridge.passThrough && !bridge.passThrough.destroyed && !isSettled) {
          isSettled = true;
          bridge.session.status = 'FAILED';
          bridge.passThrough.destroy();
          transferManager.markFailed(bridge.session.transferId, 'Sender disconnected mid-stream');
          this.activeBridges.delete(sessionId);
          reject(new Error('Sender disconnected mid-stream'));
        }
      });

      inputStream.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        bridge.session.status = 'FAILED';
        bridge.passThrough.destroy();
        transferManager.markFailed(bridge.session.transferId, err.message);
        this.activeBridges.delete(sessionId);
        reject(err);
      });
    });
  }

  /**
   * Recipient pulls live streaming chunks from the relay.
   * Data is streamed directly to client HTTP response as it arrives.
   */
  public async handleReceiverStream(
    sessionId: string,
    reply: FastifyReply,
    overrideFilename?: string
  ): Promise<void> {
    const bridge = this.activeBridges.get(sessionId);
    if (!bridge) {
      throw new Error(`Relay session ${sessionId} not found or expired`);
    }

    bridge.receiverConnected = true;
    bridge.receiverReply = reply;
    bridge.lastActivity = Date.now();

    const actualFileName = overrideFilename || bridge.session.fileName;
    const safeAscii = actualFileName.replace(/["\\]/g, '_');
    reply.header('Content-Type', bridge.session.mimeType || 'application/octet-stream');
    reply.header('Content-Length', bridge.session.fileSize);
    reply.header(
      'Content-Disposition',
      `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(actualFileName)}`
    );
    reply.header('X-ShareLAN-Transport', 'RELAY_STREAM');

    if (reply.raw && typeof reply.raw.on === 'function') {
      reply.raw.on('close', () => {
        if (!reply.raw.writableEnded && bridge.passThrough && !bridge.passThrough.destroyed) {
          bridge.passThrough.destroy();
          this.activeBridges.delete(sessionId);
        }
      });
    }

    // Notify waiting sender that receiver is connected and ready
    if (bridge.onReceiverReady) {
      bridge.onReceiverReady();
      bridge.onReceiverReady = undefined;
    }

    // Pipe in-memory bounded stream directly to the receiver response
    return reply.send(bridge.passThrough);
  }

  public cancelSession(sessionId: string): void {
    const bridge = this.activeBridges.get(sessionId);
    if (bridge) {
      bridge.session.status = 'CANCELLED';
      if (!bridge.passThrough.destroyed) {
        bridge.passThrough.destroy();
      }
      this.activeBridges.delete(sessionId);
    }
  }

  public cleanupAbandoned(): void {
    const now = Date.now();
    for (const [id, bridge] of this.activeBridges.entries()) {
      // If expired or idle for > 60 seconds with no stream active
      const isExpired = now > bridge.session.expiresAt;
      const isIdleTimeout =
        bridge.session.status === 'OFFERED' && now - bridge.lastActivity > 60000;

      if (isExpired || isIdleTimeout) {
        bridge.passThrough.destroy();
        this.activeBridges.delete(id);
      }
    }
  }

  public destroy(): void {
    clearInterval(this.cleanupTimer);
    for (const bridge of this.activeBridges.values()) {
      bridge.passThrough.destroy();
    }
    this.activeBridges.clear();
  }
}

export const relayBridge = new RelayBridgeManager();
