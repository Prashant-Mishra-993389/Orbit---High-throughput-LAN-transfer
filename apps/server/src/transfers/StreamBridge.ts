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

    // Guard against unhandled 'error' events
    passThrough.on('error', (err) => {
      console.debug(`[StreamBridge] Handled passThrough error for ${params.transferId}: ${err.message}`);
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
      let isSettled = false;

      const onBridgeTerminated = (err?: Error) => {
        if (isSettled) return;
        const session = transferManager.getSession(transferId);
        if (
          session &&
          (session.status === 'COMPLETED' ||
            (session.fileSize > 0 &&
              (session.bytesTransferred >= session.fileSize ||
                session.bytesTransferred >= session.fileSize - 65536)))
        ) {
          isSettled = true;
          this.bridges.delete(transferId);
          resolve({
            finalHash: session.finalHash || '',
            bytesTransferred: session.bytesTransferred,
          });
          return;
        }

        // If all expected bytes were transferred, this is a clean completion, NOT a failure!
        if (
          bridge &&
          bridge.totalBytes > 0 &&
          (bridge.bytesTransferred >= bridge.totalBytes ||
            bridge.bytesTransferred >= bridge.totalBytes - 65536)
        ) {
          isSettled = true;
          const finalHash = bridge.hasher.digest('hex');
          transferManager.markCompleted(transferId, finalHash);
          this.bridges.delete(transferId);
          resolve({
            finalHash,
            bytesTransferred: bridge.bytesTransferred,
          });
          return;
        }

        isSettled = true;
        const error = err || new Error('Receiver disconnected or transfer cancelled');
        try {
          if (!inputStream.destroyed) {
            inputStream.destroy();
          }
        } catch {}
        this.bridges.delete(transferId);
        transferManager.markFailed(transferId, error.message);
        reject(error);
      };

      bridge!.passThrough.once('error', onBridgeTerminated);
      bridge!.passThrough.once('close', () => {
        if (isSettled) return;
        const session = transferManager.getSession(transferId);
        if (
          session &&
          (session.status === 'COMPLETED' ||
            (session.fileSize > 0 &&
              (session.bytesTransferred >= session.fileSize ||
                session.bytesTransferred >= session.fileSize - 65536)))
        ) {
          isSettled = true;
          this.bridges.delete(transferId);
          resolve({
            finalHash: session.finalHash || '',
            bytesTransferred: session.bytesTransferred,
          });
          return;
        }
        if (
          bridge &&
          bridge.totalBytes > 0 &&
          (bridge.bytesTransferred >= bridge.totalBytes ||
            bridge.bytesTransferred >= bridge.totalBytes - 65536)
        ) {
          isSettled = true;
          const finalHash = bridge.hasher.digest('hex');
          transferManager.markCompleted(transferId, finalHash);
          this.bridges.delete(transferId);
          resolve({
            finalHash,
            bytesTransferred: bridge.bytesTransferred,
          });
          return;
        }
        if (!inputStream.readableEnded && !isSettled) {
          onBridgeTerminated();
        }
      });

      inputStream.on('data', (chunk: Buffer) => {
        if (isSettled || bridge!.passThrough.destroyed) {
          onBridgeTerminated();
          return;
        }

        bridge!.bytesTransferred += chunk.length;
        bridge!.hasher.update(chunk);

        // Update progress in control plane
        transferManager.recordStreamBytes(transferId, bridge!.bytesTransferred);

        // Push directly to receiver via PassThrough with backpressure
        const canContinue = bridge!.passThrough.write(chunk);
        if (!canContinue) {
          inputStream.pause();
          bridge!.passThrough.once('drain', () => {
            if (!bridge!.passThrough.destroyed && !isSettled) {
              inputStream.resume();
            } else {
              onBridgeTerminated();
            }
          });
        }

        // If all bytes have been pushed, cleanly end the PassThrough stream
        if (bridge!.totalBytes > 0 && bridge!.bytesTransferred >= bridge!.totalBytes) {
          try {
            bridge!.passThrough.end();
          } catch {}
        }
      });

      inputStream.on('end', () => {
        if (isSettled) return;
        isSettled = true;
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
        if (isSettled) return;
        if (bridge && bridge.totalBytes > 0 && bridge.bytesTransferred >= bridge.totalBytes) {
          isSettled = true;
          const finalHash = bridge.hasher.digest('hex');
          transferManager.markCompleted(transferId, finalHash);
          this.bridges.delete(transferId);
          resolve({
            finalHash,
            bytesTransferred: bridge.bytesTransferred,
          });
          return;
        }
        if (!inputStream.readableEnded && bridge?.passThrough && !bridge.passThrough.destroyed) {
          isSettled = true;
          bridge.passThrough.destroy();
          transferManager.markFailed(transferId, 'Sender disconnected mid-stream');
          this.bridges.delete(transferId);
          reject(new Error('Sender disconnected mid-stream'));
        }
      });

      inputStream.on('error', (err) => {
        if (isSettled) return;
        if (bridge && bridge.totalBytes > 0 && bridge.bytesTransferred >= bridge.totalBytes) {
          isSettled = true;
          const finalHash = bridge.hasher.digest('hex');
          transferManager.markCompleted(transferId, finalHash);
          this.bridges.delete(transferId);
          resolve({
            finalHash,
            bytesTransferred: bridge.bytesTransferred,
          });
          return;
        }
        isSettled = true;
        bridge!.passThrough.destroy();
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
    reply: FastifyReply,
    overrideFilename?: string
  ): Promise<void> {
    let bridge = this.bridges.get(transferId);
    if (!bridge) {
      throw new Error(`Transfer ${transferId} not found or stream already closed`);
    }

    bridge.receiverConnected = true;
    bridge.receiverReply = reply;

    const actualFileName = overrideFilename || bridge.fileName;
    const safeAscii = actualFileName.replace(/[^\x20-\x7E]|["\\]/g, '_');
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Length', bridge.totalBytes);
    reply.header(
      'Content-Disposition',
      `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(actualFileName)}`
    );
    reply.header('X-Content-Type-Options', 'nosniff');

    // Track receiver disconnection mid-stream
    if (reply.raw && typeof reply.raw.on === 'function') {
      reply.raw.on('close', () => {
        const session = transferManager.getSession(transferId);
        if (
          session &&
          (session.status === 'COMPLETED' ||
            (session.fileSize > 0 &&
              (session.bytesTransferred >= session.fileSize ||
                session.bytesTransferred >= session.fileSize - 65536)))
        ) {
          return;
        }
        // If all expected bytes have already been transferred, receiver closing the connection is normal completion!
        if (
          bridge &&
          bridge.totalBytes > 0 &&
          (bridge.bytesTransferred >= bridge.totalBytes ||
            bridge.bytesTransferred >= bridge.totalBytes - 65536)
        ) {
          return;
        }
        if (!reply.raw.writableEnded && bridge?.passThrough && !bridge.passThrough.destroyed) {
          console.warn(`Receiver closed connection early for transfer ${transferId}`);
          bridge.passThrough.destroy();
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
      if (!bridge.passThrough.destroyed) {
        bridge.passThrough.destroy();
      }
      this.bridges.delete(transferId);
    }
  }
}

export const streamBridge = new StreamBridgeManager();
