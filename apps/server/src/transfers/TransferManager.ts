import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import {
  TransferSession,
  TransferStatus,
  TransferRole,
  TransferDirection,
  TransportMode,
  ProgressPayload,
  PROGRESS_THROTTLE_MS,
  DEFAULT_CHUNK_SIZE,
} from '@sharelan/protocol';
import { ThroughputCalculator, calculateETA } from '@sharelan/shared';
import { config } from '../config/index.js';

interface InternalSessionState {
  session: TransferSession;
  throughputCalc: ThroughputCalculator;
  lastProgressEmitTime: number;
}

export class TransferManager extends EventEmitter {
  private sessions = new Map<string, InternalSessionState>();

  constructor() {
    super();
  }

  public createSession(params: {
    transferId?: string;
    fileName: string;
    fileSize: number;
    mimeType?: string;
    expectedHash?: string;
    role?: TransferRole;
    direction?: TransferDirection;
    transportMode?: TransportMode;
    senderDeviceId?: string;
    senderDeviceName?: string;
    receiverDeviceId?: string;
    receiverDeviceName?: string;
    chunkSize?: number;
    status?: TransferStatus;
  }): TransferSession {
    const transferId = params.transferId || crypto.randomUUID();
    const now = Date.now();

    const session: TransferSession = {
      transferId,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      chunkSize: params.chunkSize || config.chunkSize || DEFAULT_CHUNK_SIZE,
      expectedHash: params.expectedHash,
      role: params.role || 'receiver',
      direction: params.direction || (params.role === 'sender' ? 'OUTGOING' : 'INCOMING'),
      transportMode: params.transportMode || 'DIRECT_LAN',
      senderDeviceId: params.senderDeviceId,
      senderDeviceName: params.senderDeviceName,
      receiverDeviceId: params.receiverDeviceId,
      receiverDeviceName: params.receiverDeviceName,
      status: params.status || 'CREATED',
      bytesTransferred: 0,
      verifiedOffset: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      etaSeconds: 0,
      percentage: 0,
      createdAt: now,
      updatedAt: now,
    };

    const internalState: InternalSessionState = {
      session,
      throughputCalc: new ThroughputCalculator(3000),
      lastProgressEmitTime: 0,
    };

    this.sessions.set(transferId, internalState);
    this.emit('transfer:created', session);
    return { ...session };
  }

  public getSession(transferId: string): TransferSession | undefined {
    const state = this.sessions.get(transferId);
    return state ? { ...state.session } : undefined;
  }

  public getAllSessions(): TransferSession[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s.session }));
  }

  public markOffered(transferId: string): void {
    const state = this.sessions.get(transferId);
    if (!state) return;
    state.session.status = 'OFFERED';
    state.session.updatedAt = Date.now();
    this.emit('transfer:state_change', { transferId, status: 'OFFERED' });
  }

  public markAccepted(
    transferId: string,
    receiverInfo?: { receiverDeviceId?: string; receiverDeviceName?: string; receiverClientId?: string }
  ): void {
    const state = this.sessions.get(transferId);
    if (!state) return;

    state.session.status = 'ACCEPTED';
    if (receiverInfo?.receiverDeviceId) state.session.receiverDeviceId = receiverInfo.receiverDeviceId;
    if (receiverInfo?.receiverDeviceName) state.session.receiverDeviceName = receiverInfo.receiverDeviceName;
    state.session.updatedAt = Date.now();

    this.emit('transfer:state_change', { transferId, status: 'ACCEPTED' });
  }

  public markConnecting(transferId: string, transportMode?: TransportMode): void {
    const state = this.sessions.get(transferId);
    if (!state) return;

    state.session.status = 'CONNECTING';
    if (transportMode) state.session.transportMode = transportMode;
    state.session.updatedAt = Date.now();

    this.emit('transfer:state_change', { transferId, status: 'CONNECTING' });
  }

  public startTransferring(transferId: string, tempFilePath?: string): void {
    const state = this.sessions.get(transferId);
    if (!state) return;

    state.session.status = 'TRANSFERRING';
    if (tempFilePath) state.session.tempFilePath = tempFilePath;
    state.session.updatedAt = Date.now();

    this.emit('transfer:state_change', { transferId, status: 'TRANSFERRING' });
  }

  public recordStreamBytes(transferId: string, totalBytesReceived: number): ProgressPayload | null {
    const state = this.sessions.get(transferId);
    if (!state) return null;

    if (state.session.status !== 'TRANSFERRING') {
      state.session.status = 'TRANSFERRING';
    }

    const now = Date.now();
    state.session.bytesTransferred = totalBytesReceived;
    state.session.updatedAt = now;
    state.session.percentage =
      state.session.fileSize > 0
        ? Math.min(100, parseFloat(((totalBytesReceived / state.session.fileSize) * 100).toFixed(1)))
        : 0;

    state.throughputCalc.recordProgress(totalBytesReceived, now);
    state.session.currentSpeed = state.throughputCalc.getCurrentSpeed(now);
    state.session.averageSpeed = state.throughputCalc.getAverageSpeed(now);
    state.session.etaSeconds = calculateETA(
      state.session.fileSize,
      totalBytesReceived,
      state.session.currentSpeed || state.session.averageSpeed
    );

    // Throttle progress events to prevent flooding WebSockets
    if (now - state.lastProgressEmitTime >= PROGRESS_THROTTLE_MS || totalBytesReceived >= state.session.fileSize) {
      state.lastProgressEmitTime = now;
      const progress: ProgressPayload = {
        transferId,
        role: state.session.role,
        bytesTransferred: totalBytesReceived,
        totalBytes: state.session.fileSize,
        percentage: state.session.percentage,
        currentSpeed: state.session.currentSpeed,
        averageSpeed: state.session.averageSpeed,
        etaSeconds: state.session.etaSeconds,
        status: state.session.status,
        transportMode: state.session.transportMode,
        timestamp: now,
      };
      this.emit('transfer:progress', progress);
      return progress;
    }

    return null;
  }

  public markVerifying(transferId: string): void {
    const state = this.sessions.get(transferId);
    if (!state) return;

    state.session.status = 'VERIFYING';
    state.session.updatedAt = Date.now();
    this.emit('transfer:state_change', { transferId, status: 'VERIFYING' });
  }

  public markCompleted(transferId: string, finalHash: string, finalFilePath?: string): void {
    const state = this.sessions.get(transferId);
    if (!state) return;

    const now = Date.now();
    state.session.status = 'COMPLETED';
    state.session.finalHash = finalHash;
    if (finalFilePath) state.session.finalFilePath = finalFilePath;
    state.session.percentage = 100;
    state.session.bytesTransferred = state.session.fileSize;
    state.session.updatedAt = now;
    state.session.completedAt = now;
    state.session.currentSpeed = 0;
    state.session.etaSeconds = 0;

    this.emit('transfer:completed', {
      transferId,
      finalHash,
      fileName: state.session.fileName,
      finalFilePath,
      bytesTransferred: state.session.fileSize,
    });
  }

  public markFailed(transferId: string, error: string): void {
    const state = this.sessions.get(transferId);
    if (!state) return;

    // A transfer that has ALREADY completed verification and marked COMPLETED cannot be failed by a socket close!
    if (state.session.status === 'COMPLETED') return;

    // If all bytes were transferred, only fail if there is an explicit hash corruption or verification error
    const isIntegrityError =
      error.toLowerCase().includes('hash') ||
      error.toLowerCase().includes('integrity') ||
      error.toLowerCase().includes('corrupt') ||
      error.toLowerCase().includes('mismatch');

    if (
      !isIntegrityError &&
      state.session.fileSize > 0 &&
      state.session.bytesTransferred >= state.session.fileSize
    ) {
      this.markCompleted(transferId, state.session.finalHash || '');
      return;
    }

    state.session.status = 'FAILED';
    state.session.error = error;
    state.session.updatedAt = Date.now();
    state.session.currentSpeed = 0;

    this.emit('transfer:failed', { transferId, error });
  }

  public markRejected(transferId: string, reason?: string): void {
    const state = this.sessions.get(transferId);
    if (!state) return;

    state.session.status = 'REJECTED';
    state.session.error = reason;
    state.session.updatedAt = Date.now();

    this.emit('transfer:state_change', { transferId, status: 'REJECTED', error: reason });
  }

  public async cancelTransfer(transferId: string): Promise<void> {
    const state = this.sessions.get(transferId);
    if (!state) return;

    state.session.status = 'CANCELLED';
    state.session.updatedAt = Date.now();

    // Clean up temporary staging file
    if (state.session.tempFilePath) {
      try {
        await fs.unlink(state.session.tempFilePath);
      } catch {
        // Ignore if file doesn't exist
      }
    }

    this.emit('transfer:cancelled', { transferId });
  }
}

export const transferManager = new TransferManager();
