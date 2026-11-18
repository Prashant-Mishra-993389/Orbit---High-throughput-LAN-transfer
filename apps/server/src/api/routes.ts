import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import net from 'node:net';
import crypto from 'node:crypto';
import {
  SHARELAN_PROTOCOL_VERSION,
  DEFAULT_CHUNK_SIZE,
  TransferOffer,
  TransportMode,
} from '@sharelan/protocol';
import { isPathInside } from '../security/sanitizer.js';
import { config } from '../config/index.js';
import { transferManager } from '../transfers/TransferManager.js';
import { StreamManager } from '../transfers/StreamManager.js';
import { streamBridge } from '../transfers/StreamBridge.js';
import { relayBridge } from '../transfers/RelayBridge.js';
import { pairingManager } from '../pairing/PairingManager.js';
import { tunnelManager } from '../tunnel/TunnelManager.js';
import { peerDiscovery } from '../discovery/peerDiscovery.js';
import { getNetworkDiagnostics } from '../diagnostics/network.js';
import { wsHub } from '../websocket/server.js';

// In-memory active offers with strict TTL cleanup
const OFFER_TTL_MS = 3 * 60 * 1000; // 3-minute TTL for pending transfer offers
const activeOffers = new Map<string, TransferOffer>();

function pruneStaleOffers(): void {
  const now = Date.now();
  for (const [id, offer] of activeOffers.entries()) {
    if (offer.status === 'OFFERED' && now - offer.createdAt > OFFER_TTL_MS) {
      activeOffers.delete(id);
      streamBridge.removeBridge(id);
      relayBridge.cancelSession(id);
      transferManager.cancelTransfer(id).catch(() => {});
    }
  }
}

// Background sweep for expired offers every 30 seconds
setInterval(pruneStaleOffers, 30000).unref();

export const apiRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Lightweight HTTP ping for client-side direct connectivity probes
  server.get('/api/system/ping', async () => {
    return {
      status: 'ok',
      protocolVersion: SHARELAN_PROTOCOL_VERSION,
      deviceName: osHostname(),
      timestamp: Date.now(),
    };
  });

  // Public Tunnel Status (Cloudflare Tunnel for Hostel AP Isolation)
  server.get('/api/system/tunnel', async () => {
    return {
      available: tunnelManager.isAvailable(),
      url: tunnelManager.getPublicUrl(),
    };
  });

  // Start Public Tunnel manually
  server.post('/api/system/tunnel/start', async () => {
    const url = await tunnelManager.start(config.port);
    return { success: true, url };
  });

  // Set or update public tunnel URL
  server.post<{ Body: { url: string } }>('/api/system/tunnel/url', async (request, reply) => {
    const { url } = request.body || {};
    if (!url) return reply.status(400).send({ error: 'url required' });
    tunnelManager.setPublicUrl(url);
    return { success: true, url };
  });

  // System network diagnostics
  server.get('/api/system/network', async () => {
    return getNetworkDiagnostics(config.port, tunnelManager.getPublicUrl());
  });

  // Test direct peer connectivity (Detects Hostel Wi-Fi AP isolation)
  server.get<{ Querystring: { ip: string; port?: string } }>(
    '/api/system/test-peer-connectivity',
    async (request, reply) => {
      const { ip, port: portStr } = request.query;
      const port = parseInt(portStr || `${config.port}`, 10);

      if (!ip) {
        return reply.status(400).send({ error: 'IP address required' });
      }

      const isReachable = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2500);

        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });

        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });

        socket.connect(port, ip);
      });

      return {
        targetIp: ip,
        targetPort: port,
        directLanAvailable: isReachable,
        status: isReachable ? 'DIRECT_LAN_AVAILABLE' : 'DIRECT_LAN_BLOCKED',
        note: isReachable
          ? 'Direct peer communication is unblocked.'
          : 'Direct connection failed. Hostel AP-isolation or firewall is active. Use relay stream.',
      };
    }
  );

  // ============================================================
  // 6-DIGIT CODE PAIRING & OUT-OF-BAND DISCOVERY
  // ============================================================

  // 6-digit Code Pairing: Create Host Session
  server.post<{
    Body: {
      hostClientId: string;
      hostDeviceName?: string;
      ttlMs?: number;
    };
  }>('/api/pairing/create', async (request, reply) => {
    const { hostClientId, hostDeviceName, ttlMs } = request.body;
    if (!hostClientId) {
      return reply.status(400).send({ error: 'hostClientId is required' });
    }
    const diag = getNetworkDiagnostics(config.port);
    const session = pairingManager.createSession({
      hostClientId,
      hostDeviceName: hostDeviceName || osHostname(),
      hostIp: diag.localIp,
      hostPort: config.port,
      ttlMs,
    });
    return reply.status(201).send(pairingManager.toPublicSession(session));
  });

  // 6-digit Code Pairing: Guest Joins Session
  server.post<{
    Body: {
      code: string;
      guestClientId: string;
      guestDeviceName?: string;
    };
  }>('/api/pairing/join', async (request, reply) => {
    const { code, guestClientId, guestDeviceName } = request.body;
    if (!code || !guestClientId) {
      return reply.status(400).send({ error: 'code and guestClientId are required' });
    }
    const diag = getNetworkDiagnostics(config.port);
    const session = pairingManager.joinSession({
      code,
      guestClientId,
      guestDeviceName: guestDeviceName || osHostname(),
      guestIp: diag.localIp,
      guestPort: config.port,
    });

    if (!session) {
      // Distributed LAN Pairing Resolver:
      // If code was created on another laptop on the local network/hotspot,
      // probe all discovered peers and sweep the subnet to find the host.
      const peers = peerDiscovery.getDiscoveredPeers();
      for (const peer of peers) {
        if (peer.ip === diag.localIp && peer.port === config.port) continue;
        try {
          const remoteUrl = `http://${peer.ip}:${peer.port}/api/pairing/join`;
          const resp = await fetch(remoteUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, guestClientId, guestDeviceName }),
            signal: AbortSignal.timeout(2000),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            if (data.session) {
              wsHub.broadcast({
                type: 'pairing:matched',
                payload: data.session,
              });
              return data;
            }
          }
        } catch {
          // Continue checking next peer
        }
      }

      // If still not found, execute a fast subnet sweep to find any unannounced hosts
      try {
        const sweptPeers = await peerDiscovery.sweepSubnet();
        for (const peer of sweptPeers) {
          if (peer.ip === diag.localIp && peer.port === config.port) continue;
          try {
            const remoteUrl = `http://${peer.ip}:${peer.port}/api/pairing/join`;
            const resp = await fetch(remoteUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, guestClientId, guestDeviceName }),
              signal: AbortSignal.timeout(2000),
            });
            if (resp.ok) {
              const data: any = await resp.json();
              if (data.session) {
                wsHub.broadcast({
                  type: 'pairing:matched',
                  payload: data.session,
                });
                return data;
              }
            }
          } catch {}
        }
      } catch {}

      return reply.status(404).send({ error: 'Invalid or expired pairing code' });
    }

    return {
      success: true,
      session: pairingManager.toPublicSession(session),
      sharedSecret: session.sharedSecret,
    };
  });

  // On-demand LAN subnet sweep to bypass router/hotspot AP isolation
  server.post('/api/discovery/sweep', async () => {
    const peers = await peerDiscovery.sweepSubnet();
    return { success: true, peers };
  });

  // Check pairing session status
  server.get<{ Params: { code: string } }>('/api/pairing/:code/status', async (request, reply) => {
    const session = pairingManager.getSession(request.params.code);
    if (!session) {
      return reply.status(404).send({ error: 'Pairing session not found or expired' });
    }
    return pairingManager.toPublicSession(session);
  });

  // Instant QR Code Auto-Connect & Pairing
  server.post<{
    Body: {
      hostClientId: string;
      guestClientId: string;
      guestDeviceName?: string;
      hostDeviceName?: string;
    };
  }>('/api/pairing/auto-connect', async (request, reply) => {
    const { hostClientId, guestClientId, guestDeviceName, hostDeviceName } = request.body || {};
    if (!hostClientId || !guestClientId) {
      return reply.status(400).send({ error: 'hostClientId and guestClientId are required' });
    }

    const diag = getNetworkDiagnostics(config.port);
    const clientIp = request.ip || diag.localIp;

    const matchedSession = {
      code: 'AUTO-PAIR',
      hostClientId,
      hostDeviceName: hostDeviceName || osHostname(),
      hostIp: diag.localIp,
      hostPort: config.port,
      guestClientId,
      guestDeviceName: guestDeviceName || 'Nearby Device',
      guestIp: clientIp,
      guestPort: config.port,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      status: 'PAIRED' as const,
    };

    wsHub.broadcast({
      type: 'pairing:matched',
      payload: matchedSession,
    });

    return {
      success: true,
      session: matchedSession,
    };
  });

  // ============================================================
  // ZERO-DISK IN-MEMORY RELAY STREAMING
  // ============================================================

  // Relay: Create stream forwarding session
  // Zero disk storage — strictly in-memory PassThrough stream with 64KB backpressure
  server.post<{
    Body: {
      transferId: string;
      fileName: string;
      fileSize: number;
      mimeType?: string;
      senderClientId: string;
      receiverClientId?: string;
      sessionId?: string;
    };
  }>('/api/relay/sessions', async (request, reply) => {
    const { transferId, fileName, fileSize, mimeType, senderClientId, receiverClientId, sessionId } = request.body;
    if (!transferId || !fileName || typeof fileSize !== 'number') {
      return reply.status(400).send({ error: 'transferId, fileName, and fileSize are required' });
    }

    const session = relayBridge.createSession({
      sessionId: sessionId || transferId,
      transferId,
      fileName,
      fileSize,
      mimeType,
      senderClientId,
      receiverClientId,
    });

    return reply.status(201).send(session);
  });

  // Relay: Sender pushes live stream into relay memory buffer
  // Zero bytes written to disk!
  server.put<{ Params: { sessionId: string } }>(
    '/api/relay/:sessionId/stream',
    { bodyLimit: 100 * 1024 * 1024 * 1024 },
    async (request, reply) => {
      request.raw.setTimeout(0);
      reply.raw.setTimeout(0);
      const { sessionId } = request.params;
      const inputStream = (request.body as Readable) || request.raw;

      try {
        const result = await relayBridge.handleSenderStream(sessionId, inputStream);
        if (!reply.raw.destroyed && !reply.sent) {
          return reply.send({
            success: true,
            sessionId,
            bytesRelayed: result.bytesRelayed,
            finalHash: result.finalHash,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!reply.raw.destroyed && !reply.sent) {
          return reply.status(500).send({ error: msg });
        }
      }
    }
  );

  // Relay: Recipient pulls live stream from relay memory buffer
  // Zero bytes stored on relay!
  server.get<{ Params: { sessionId: string }; Querystring: { filename?: string } }>(
    '/api/relay/:sessionId/stream',
    async (request, reply) => {
      request.raw.setTimeout(0);
      reply.raw.setTimeout(0);
      const { sessionId } = request.params;
      const { filename } = request.query || {};

      try {
        await relayBridge.handleReceiverStream(sessionId, reply, filename);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!reply.raw.destroyed && !reply.sent) {
          return reply.status(500).send({ error: msg });
        }
      }
    }
  );

  // Relay: Get session status
  server.get<{ Params: { sessionId: string } }>('/api/relay/:sessionId/status', async (request, reply) => {
    const session = relayBridge.getSession(request.params.sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Relay session not found or expired' });
    }
    return session;
  });

  // Discovered LAN devices
  server.get('/api/devices', async () => {
    return peerDiscovery.getDiscoveredPeers();
  });

  // Device capabilities
  server.get('/api/capabilities', async () => {
    const diag = getNetworkDiagnostics(config.port);
    return {
      protocolVersion: SHARELAN_PROTOCOL_VERSION,
      transports: ['http-stream', 'stream-pipe', 'relay'],
      hashAlgorithms: ['sha256'],
      resumable: true,
      maxChunkSize: config.chunkSize || DEFAULT_CHUNK_SIZE,
      storageDirectory: config.storageDir,
      localIp: diag.localIp,
      deviceName: osHostname(),
    };
  });

  // ============================================================
  // AUTHORITATIVE TRANSFER LIFECYCLE
  // ============================================================

  // Create an Outbound Transfer Offer (Sender initiates)
  server.post<{
    Body: {
      transferId?: string;
      fileName: string;
      fileSize: number;
      mimeType?: string;
      expectedHash?: string;
      senderClientId: string;
      senderDeviceName?: string;
      targetDeviceId?: string;
      targetClientId?: string;
      transportMode?: TransportMode;
      relaySessionId?: string;
      e2eeSecret?: string;
    };
  }>('/api/transfers/offer', async (request, reply) => {
    const {
      fileName,
      fileSize,
      mimeType,
      expectedHash,
      senderClientId,
      senderDeviceName,
      targetDeviceId,
      targetClientId,
      transportMode,
      relaySessionId,
      e2eeSecret,
    } = request.body;

    if (!fileName || typeof fileSize !== 'number' || fileSize < 0) {
      return reply.status(400).send({ error: 'Valid fileName and fileSize are required' });
    }

    const diag = getNetworkDiagnostics(config.port);
    const transferId = request.body.transferId || crypto.randomUUID();

    const offer: TransferOffer = {
      transferId,
      fileName,
      fileSize,
      mimeType: mimeType || 'application/octet-stream',
      senderClientId: senderClientId || 'anonymous-client',
      senderDeviceId: osHostname(),
      senderDeviceName: senderDeviceName || osHostname(),
      senderIp: diag.localIp,
      senderPort: config.port,
      targetDeviceId,
      targetClientId,
      transportMode: transportMode || 'DIRECT_LAN',
      relaySessionId: relaySessionId || transferId,
      expectedHash,
      e2eeSecret,
      status: 'OFFERED',
      createdAt: Date.now(),
    };

    activeOffers.set(transferId, offer);

    // Register session in authoritative TransferManager
    transferManager.createSession({
      transferId,
      fileName,
      fileSize,
      mimeType,
      expectedHash,
      role: 'sender',
      transportMode: offer.transportMode,
      senderDeviceId: offer.senderDeviceId,
      senderDeviceName: offer.senderDeviceName,
      receiverDeviceId: targetDeviceId,
      status: 'OFFERED',
    });

    // Initialize real-time streaming bridge (Zero bytes written to sender disk!)
    streamBridge.createBridge({
      transferId,
      fileName,
      fileSize,
      mimeType,
    });

    // If relay mode is indicated, initialize relay bridge session as well
    if (transportMode === 'RELAY_STREAM' || relaySessionId) {
      relayBridge.createSession({
        sessionId: relaySessionId || transferId,
        transferId,
        fileName,
        fileSize,
        mimeType,
        senderClientId: senderClientId || 'anonymous-client',
        receiverClientId: targetClientId,
      });
    }

    // Broadcast offer to connected peers in real time
    wsHub.broadcast({
      type: 'transfer:offer',
      payload: offer,
    });

    return reply.status(201).send(offer);
  });

  // Get active offers (filtered for freshness & sorted newest first)
  server.get('/api/transfers/offers', async () => {
    pruneStaleOffers();
    return Array.from(activeOffers.values())
      .filter((o) => o.status === 'OFFERED' && Date.now() - o.createdAt <= OFFER_TTL_MS)
      .sort((a, b) => b.createdAt - a.createdAt);
  });

  // Recipient Accepts Transfer Offer
  server.post<{
    Params: { id: string };
    Body?: { receiverClientId?: string; receiverDeviceName?: string; receiverDeviceId?: string };
  }>('/api/transfers/:id/accept', async (request, reply) => {
    const { id } = request.params;
    const { receiverClientId, receiverDeviceName, receiverDeviceId } = request.body || {};
    const offer = activeOffers.get(id);

    if (!offer) {
      return reply.status(404).send({ error: 'Offer not found' });
    }

    offer.status = 'ACCEPTED';
    offer.receiverClientId = receiverClientId;
    offer.receiverDeviceName = receiverDeviceName;
    offer.receiverDeviceId = receiverDeviceId;

    // Update authoritative TransferManager
    transferManager.markAccepted(id, {
      receiverClientId,
      receiverDeviceName,
      receiverDeviceId,
    });
    transferManager.markConnecting(id, offer.transportMode);

    // Broadcast atomic acceptance to sender
    wsHub.broadcast({
      type: 'transfer:accepted',
      payload: {
        transferId: id,
        receiverClientId,
        receiverDeviceName,
        receiverDeviceId,
        transportMode: offer.transportMode,
      },
    });

    return { success: true, transferId: id };
  });

  // Recipient Rejects Transfer Offer
  server.post<{
    Params: { id: string };
    Body?: { reason?: string };
  }>('/api/transfers/:id/reject', async (request, reply) => {
    const { id } = request.params;
    const { reason } = request.body || {};
    const offer = activeOffers.get(id);

    if (offer) {
      offer.status = 'REJECTED';
    }

    transferManager.markRejected(id, reason);
    activeOffers.delete(id);
    streamBridge.removeBridge(id);
    relayBridge.cancelSession(id);

    wsHub.broadcast({
      type: 'transfer:reject',
      payload: { transferId: id, reason },
    });

    return { success: true, transferId: id };
  });

  // Get partial verified offset for resumability
  server.get<{ Params: { id: string } }>('/api/transfers/:id/offset', async (request, reply) => {
    const offset = await StreamManager.getPartialOffset(request.params.id);
    return { transferId: request.params.id, offset };
  });

  // Sender streams live file bytes into the StreamBridge
  // Directly passes through in memory with 64KB backpressure to the receiver
  // Zero duplicate file stored on sender!
  server.put<{ Params: { id: string } }>(
    '/api/transfers/:id/live-pipe',
    { bodyLimit: 100 * 1024 * 1024 * 1024 },
    async (request, reply) => {
      request.raw.setTimeout(0);
      reply.raw.setTimeout(0);
      const { id } = request.params;
      const inputStream = (request.body as Readable) || request.raw;

      try {
        const result = await streamBridge.handleSenderStream(id, inputStream);
        if (!reply.raw.destroyed && !reply.sent) {
          return reply.send({
            success: true,
            transferId: id,
            bytesTransferred: result.bytesTransferred,
            finalHash: result.finalHash,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!reply.raw.destroyed && !reply.sent) {
          return reply.status(500).send({ error: msg });
        }
      }
    }
  );

  // Recipient receives live file bytes directly from StreamBridge as sender pushes them
  // Streams simultaneously in real time without waiting for complete upload!
  server.get<{ Params: { id: string }; Querystring: { filename?: string } }>(
    '/api/transfers/:id/live-pipe',
    async (request, reply) => {
      request.raw.setTimeout(0);
      reply.raw.setTimeout(0);
      const { id } = request.params;
      const { filename } = request.query || {};

      try {
        await streamBridge.handleReceiverStream(id, reply, filename);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!reply.raw.destroyed && !reply.sent) {
          return reply.status(500).send({ error: msg });
        }
      }
    }
  );

  // Direct Inbound Push (Laptop A pushes directly to Laptop B's server)
  // Laptop B receives stream and writes to Laptop B's disk; Laptop A writes 0 bytes!
  server.post<{
    Body: {
      transferId?: string;
      fileName: string;
      fileSize: number;
      mimeType?: string;
      expectedHash?: string;
      senderDeviceName?: string;
    };
  }>('/api/transfers/inbound', async (request, reply) => {
    const { transferId, fileName, fileSize, mimeType, expectedHash, senderDeviceName } = request.body;

    if (!fileName || typeof fileSize !== 'number' || fileSize < 0) {
      return reply.status(400).send({ error: 'Valid fileName and fileSize are required' });
    }

    const session = transferManager.createSession({
      transferId,
      fileName,
      fileSize,
      mimeType,
      expectedHash,
      senderDeviceName,
      role: 'receiver',
      direction: 'INCOMING',
      status: 'ACCEPTED',
    });

    return reply.status(201).send(session);
  });

  // Stream directly into receiver disk (Data Plane)
  server.put<{
    Params: { id: string };
    Querystring: { resumeOffset?: string };
    Headers: { 'x-resume-offset'?: string };
  }>('/api/transfers/:id/stream', async (request, reply) => {
    const { id } = request.params;
    const session = transferManager.getSession(id);

    if (!session) {
      return reply.status(404).send({ error: 'Transfer session does not exist' });
    }

    const offsetStr = request.headers['x-resume-offset'] || request.query.resumeOffset;
    const resumeOffset = offsetStr ? parseInt(offsetStr, 10) : 0;

    try {
      const inputStream = (request.body as Readable) || request.raw;
      const result = await StreamManager.handleIncomingStream(id, inputStream, { resumeOffset });
      return reply.send({
        success: true,
        transferId: result.transferId,
        bytesTransferred: result.bytesTransferred,
        finalHash: result.finalHash,
        fileName: session.fileName,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: errorMsg });
    }
  });

  // List all transfers
  server.get('/api/transfers', async () => {
    return transferManager.getAllSessions();
  });

  // Get specific transfer
  server.get<{ Params: { id: string } }>('/api/transfers/:id', async (request, reply) => {
    const session = transferManager.getSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: 'Transfer not found' });
    }
    return session;
  });

  // Cancel transfer
  server.delete<{ Params: { id: string } }>('/api/transfers/:id', async (request, reply) => {
    const { id } = request.params;
    const session = transferManager.getSession(id);
    const hadOffer = activeOffers.has(id);

    if (session) {
      await transferManager.cancelTransfer(id);
    }
    streamBridge.removeBridge(id);
    relayBridge.cancelSession(id);
    activeOffers.delete(id);

    // Broadcast cancellation immediately to all peers
    wsHub.broadcast({
      type: 'transfer:cancelled' as any,
      payload: { transferId: id, reason: 'Transfer cancelled' },
    });
    wsHub.broadcast({
      type: 'transfer:state_change',
      payload: { transferId: id, status: 'CANCELLED' },
    });

    if (!session && !hadOffer) {
      return reply.status(404).send({ error: 'Transfer not found' });
    }

    return { success: true, message: 'Transfer cancelled' };
  });

  // Stream download of completed file
  server.get<{ Params: { id: string } }>('/api/files/:id/download', async (request, reply) => {
    const session = transferManager.getSession(request.params.id);
    if (!session || !session.finalFilePath) {
      return reply.status(404).send({ error: 'File or transfer not found' });
    }

    if (!isPathInside(config.storageDir, session.finalFilePath)) {
      return reply.status(403).send({ error: 'Access denied: path outside storage directory' });
    }

    try {
      const stat = await fs.promises.stat(session.finalFilePath);
      reply.header('Content-Type', session.mimeType || 'application/octet-stream');
      reply.header('Content-Length', stat.size);
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(session.fileName)}"`);

      const fileStream = fs.createReadStream(session.finalFilePath, { highWaterMark: 64 * 1024 });
      return reply.send(fileStream);
    } catch {
      return reply.status(404).send({ error: 'File not found on disk' });
    }
  });

  // Synthetic benchmark upload endpoint: reads and discards bytes to measure raw network speed
  server.post('/api/system/benchmark-upload', async (request, reply) => {
    let bytes = 0;
    const t0 = Date.now();

    for await (const chunk of request.raw) {
      bytes += (chunk as Buffer).length;
    }

    const durationSec = Math.max(0.001, (Date.now() - t0) / 1000);
    const speedBytesPerSec = bytes / durationSec;

    return reply.send({
      bytes,
      durationSec,
      speedBytesPerSec,
      speedFormatted: `${(speedBytesPerSec / (1024 * 1024)).toFixed(2)} MiB/s`,
    });
  });
};

function osHostname(): string {
  try {
    return (process.env.COMPUTERNAME || process.env.HOSTNAME || 'Orbit-Device');
  } catch {
    return 'Orbit-Device';
  }
}
