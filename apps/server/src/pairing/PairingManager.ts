import crypto from 'node:crypto';
import { PairingSession } from '@sharelan/protocol';
import { wsHub } from '../websocket/server.js';

export interface PairingSessionInternal extends PairingSession {
  sharedSecret: string;
}

export class PairingManager {
  private sessions = new Map<string, PairingSessionInternal>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Run cleanup every 30 seconds
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 30000);
    this.cleanupTimer.unref();
  }

  /**
   * Format a 6-digit code as "XXX-XXX"
   */
  private generateCode(): string {
    const num = Math.floor(100000 + Math.random() * 900000);
    const str = num.toString();
    return `${str.slice(0, 3)}-${str.slice(3)}`;
  }

  private normalizeCode(code: string): string {
    const cleaned = code.replace(/[^0-9]/g, '');
    if (cleaned.length === 6) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    return code.trim();
  }

  /**
   * Host registers a new pairing session
   */
  public createSession(params: {
    hostClientId: string;
    hostDeviceName: string;
    hostIp: string;
    hostPort: number;
    ttlMs?: number;
  }): PairingSessionInternal {
    // Generate unique code
    let code = this.generateCode();
    while (this.sessions.has(code)) {
      code = this.generateCode();
    }

    const ttl = params.ttlMs || 5 * 60 * 1000; // 5 minutes default
    const now = Date.now();
    const sharedSecret = crypto.randomBytes(32).toString('hex');

    const session: PairingSessionInternal = {
      code,
      hostClientId: params.hostClientId,
      hostDeviceName: params.hostDeviceName,
      hostIp: params.hostIp,
      hostPort: params.hostPort,
      createdAt: now,
      expiresAt: now + ttl,
      status: 'WAITING',
      sharedSecret,
    };

    this.sessions.set(code, session);

    // Notify connected clients
    wsHub.broadcast({
      type: 'pairing:created',
      payload: this.toPublicSession(session),
    });

    return session;
  }

  /**
   * Guest joins pairing session by code
   */
  public joinSession(params: {
    code: string;
    guestClientId: string;
    guestDeviceName: string;
    guestIp: string;
    guestPort: number;
  }): PairingSessionInternal | null {
    const normalized = this.normalizeCode(params.code);
    const session = this.sessions.get(normalized);

    if (!session) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      session.status = 'EXPIRED';
      this.sessions.delete(normalized);
      return null;
    }

    if (session.status !== 'WAITING') {
      return null;
    }

    // Pair matched!
    session.guestClientId = params.guestClientId;
    session.guestDeviceName = params.guestDeviceName;
    session.guestIp = params.guestIp;
    session.guestPort = params.guestPort;
    session.status = 'PAIRED';

    const publicSession = this.toPublicSession(session);

    // Broadcast match to both clients via WebSocket
    wsHub.broadcast({
      type: 'pairing:matched',
      payload: publicSession,
    });

    return session;
  }

  public getSession(code: string): PairingSessionInternal | null {
    const normalized = this.normalizeCode(code);
    const session = this.sessions.get(normalized);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      session.status = 'EXPIRED';
      this.sessions.delete(normalized);
      return null;
    }

    return session;
  }

  public removeSession(code: string): void {
    const normalized = this.normalizeCode(code);
    this.sessions.delete(normalized);
  }

  public cleanupExpired(): void {
    const now = Date.now();
    for (const [code, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(code);
        wsHub.broadcast({
          type: 'pairing:expired',
          payload: { code },
        });
      }
    }
  }

  public toPublicSession(session: PairingSessionInternal): PairingSession {
    return {
      code: session.code,
      hostClientId: session.hostClientId,
      hostDeviceName: session.hostDeviceName,
      hostIp: session.hostIp,
      hostPort: session.hostPort,
      guestClientId: session.guestClientId,
      guestDeviceName: session.guestDeviceName,
      guestIp: session.guestIp,
      guestPort: session.guestPort,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      status: session.status,
    };
  }

  public destroy(): void {
    clearInterval(this.cleanupTimer);
    this.sessions.clear();
  }
}

export const pairingManager = new PairingManager();
