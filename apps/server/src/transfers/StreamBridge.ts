import { PassThrough, Readable } from 'node:stream';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { FastifyReply } from 'fastify';
import { transferManager } from './TransferManager.js';

interface ActiveBridge {
  transferId: string;
  passThrough: PassThrough;
  hasher: crypto.Hash;
  bytesTransferred: number;
  totalBytes: number;
  fileName: string;
  mimeType?: string;
  senderConnected: boolean;
  receiverConnected: boolean;
  receiverReply?: FastifyReply;
  onReceiverReady?: (reply: FastifyReply) => void;
  onSenderReady?: (stream: Readable) => void;
  startTime?: number;
}

export class StreamBridgeManager extends EventEmitter {
  private bridges = new Map<string, ActiveBridge>();

  public createBridge(params: {
    transferId: string;
    fileName: string;
    fileSize: number;
    mimeType?: string;
  }): ActiveBridge {
    const passThrough = new PassThrough({
      highWaterMark: 64 * 1024, // 64 KiB buffer for strict backpressure and bounded memory
    });

    const bridge: ActiveBridge = {
      transferId: params.transferId,
      passThrough,
      hasher: crypto.createHash('sha256'),
      bytesTransferred: 0,
      totalBytes: params.fileSize,
      fileName: params.fileName,
      mimeType: params.mimeType,
      senderConnected: false,
      receiverConnected: false,
    };

    this.bridges.set(params.transferId, bridge);
    return bridge;
  }

  public getBridge(transferId: string): ActiveBridge | undefined {
    return this.bridges.get(transferId);
  }

  /**
   * Called by the Sender uploading live file chunks
   */
  public async handleSenderStream(
    transferId: string,
    inputStream: Readable
  ): Promise<{ finalHash: string; bytesTransferred: number }> {
    let bridge = this.bridges.get(transferId);
    if (!bridge) {
      throw new Error(`Stream bridge for transfer ${transferId} not initialized`);
    }

    bridge.senderConnected = true;
    bridge.startTime = Date.now();
    transferManager.startTransferring(transferId);

    // If receiver is not yet connected, wait up to 120 seconds for receiver to connect
    if (!bridge.receiverConnected) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for receiver to connect to live stream (120s limit)'));
        }, 120000);

        bridge!.onReceiverReady = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    }

    return new Promise((resolve, reject) => {
      inputStream.on('data', (chunk: Buffer) => {
        bridge!.bytesTransferred += chunk.length;
        bridge!.hasher.update(chunk);

        // Update progress in control plane
        transferManager.recordStreamBytes(transferId, bridge!.bytesTransferred);

        // Push directly to receiver via PassThrough with backpressure
        const canContinue = bridge!.passThrough.write(chunk);
        if (!canContinue) {
          inputStream.pause();
          bridge!.passThrough.once('drain', () => {
            inputStream.resume();
          });
        }
      });

      inputStream.on('end', () => {
        bridge!.passThrough.end();
        const finalHash = bridge!.hasher.digest('hex');
        transferManager.markCompleted(transferId, finalHash);
        this.bridges.delete(transferId);
        resolve({
          finalHash,
          bytesTransferred: bridge!.bytesTransferred,
        });
      });

      inputStream.on('close', () => {
        if (!inputStream.readableEnded && bridge?.passThrough && !bridge.passThrough.destroyed) {
          bridge.passThrough.destroy(new Error('Sender disconnected mid-stream'));
          transferManager.markFailed(transferId, 'Sender disconnected mid-stream');
          this.bridges.delete(transferId);
          reject(new Error('Sender disconnected mid-stream'));
        }
      });

      inputStream.on('error', (err) => {
        bridge!.passThrough.destroy(err);
        transferManager.markFailed(transferId, err.message);
        this.bridges.delete(transferId);
        reject(err);
      });
    });
  }

  /**
   * Called by the Recipient downloading the live stream in real time
   */
  public async handleReceiverStream(
    transferId: string,
    reply: FastifyReply
  ): Promise<void> {
    let bridge = this.bridges.get(transferId);
    if (!bridge) {
      throw new Error(`Transfer ${transferId} not found or stream already closed`);
    }

    bridge.receiverConnected = true;
    bridge.receiverReply = reply;

    const safeAscii = bridge.fileName.replace(/["\\]/g, '_');
    reply.header('Content-Type', bridge.mimeType || 'application/octet-stream');
    reply.header('Content-Length', bridge.totalBytes);
    reply.header(
      'Content-Disposition',
      `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(bridge.fileName)}`
    );

    // Track receiver disconnection mid-stream
    if (reply.raw && typeof reply.raw.on === 'function') {
      reply.raw.on('close', () => {
        if (!reply.raw.writableEnded && bridge?.passThrough && !bridge.passThrough.destroyed) {
          console.warn(`Receiver closed connection early for transfer ${transferId}`);
          bridge.passThrough.destroy(new Error('Receiver disconnected'));
          transferManager.markFailed(transferId, 'Receiver disconnected');
          this.bridges.delete(transferId);
        }
      });
    }

    // If sender was waiting for receiver, notify sender to start pushing
    if (bridge.onReceiverReady) {
      bridge.onReceiverReady(reply);
      bridge.onReceiverReady = undefined;
    }

    // Pipe the passThrough stream directly to the receiver HTTP response
    return reply.send(bridge.passThrough);
  }

  public removeBridge(transferId: string): void {
    const bridge = this.bridges.get(transferId);
    if (bridge) {
      bridge.passThrough.destroy();
      this.bridges.delete(transferId);
    }
  }
}

export const streamBridge = new StreamBridgeManager();
