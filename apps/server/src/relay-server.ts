import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { relayBridge } from './transfers/RelayBridge.js';
import { pairingManager } from './pairing/PairingManager.js';
import { wsHub, registerWebSocketRoutes } from './websocket/server.js';
import { SHARELAN_PROTOCOL_VERSION } from '@sharelan/protocol';

const joinAttemptsByIp = new Map<string, { attempts: number; resetAt: number }>();

function isJoinRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = joinAttemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    joinAttemptsByIp.set(ip, { attempts: 1, resetAt: now + 60000 });
    return false;
  }
  entry.attempts++;
  return entry.attempts > 10;
}

export async function createRelayServer(port = 37825): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024,
  });

  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Enable raw streaming body parser for zero-copy streaming
  server.addContentTypeParser('*', (_request, payload, done) => {
    done(null, payload);
  });

  await server.register(fastifyWebsocket);
  await registerWebSocketRoutes(server);

  // Production Health Check & Monitoring
  server.get('/health', async () => ({
    status: 'healthy',
    mode: 'STANDALONE_RELAY',
    protocolVersion: SHARELAN_PROTOCOL_VERSION,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    timestamp: Date.now(),
  }));

  // Ping endpoint
  server.get('/api/system/ping', async () => ({
    status: 'ok',
    mode: 'STANDALONE_RELAY',
    protocolVersion: SHARELAN_PROTOCOL_VERSION,
    timestamp: Date.now(),
  }));

  // Pairing endpoints for out-of-band cross-device pairing
  server.post<{
    Body: {
      hostClientId: string;
      hostDeviceName?: string;
      ttlMs?: number;
    };
  }>('/api/pairing/create', async (request, reply) => {
    const { hostClientId, hostDeviceName, ttlMs } = request.body || {};
    if (!hostClientId) {
      return reply.status(400).send({ error: 'hostClientId is required' });
    }
    const session = pairingManager.createSession({
      hostClientId,
      hostDeviceName: hostDeviceName || 'Relay-Client',
      hostIp: 'relay',
      hostPort: port,
      ttlMs,
    });
    return reply.status(201).send(pairingManager.toPublicSession(session));
  });

  server.post<{
    Body: {
      code: string;
      guestClientId: string;
      guestDeviceName?: string;
    };
  }>('/api/pairing/join', async (request, reply) => {
    const clientIp = request.ip || 'unknown';
    if (isJoinRateLimited(clientIp)) {
      return reply.status(429).send({
        error: 'Too many pairing attempts. Please wait a minute before trying again.',
      });
    }

    const { code, guestClientId, guestDeviceName } = request.body || {};
    if (!code || !guestClientId) {
      return reply.status(400).send({ error: 'code and guestClientId are required' });
    }
    const session = pairingManager.joinSession({
      code,
      guestClientId,
      guestDeviceName: guestDeviceName || 'Relay-Client',
      guestIp: 'relay',
      guestPort: port,
    });
    if (!session) {
      return reply.status(404).send({ error: 'Invalid or expired pairing code' });
    }
    return {
      success: true,
      session: pairingManager.toPublicSession(session),
      sharedSecret: session.sharedSecret,
    };
  });

  server.get<{ Params: { code: string } }>('/api/pairing/:code/status', async (request, reply) => {
    const session = pairingManager.getSession(request.params.code);
    if (!session) {
      return reply.status(404).send({ error: 'Pairing session not found or expired' });
    }
    return pairingManager.toPublicSession(session);
  });

  // Zero-Disk Relay Streaming Endpoints
  const MAX_RELAY_SESSIONS = parseInt(process.env.MAX_RELAY_SESSIONS || '200', 10);

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
    const { transferId, fileName, fileSize, mimeType, senderClientId, receiverClientId, sessionId } = request.body || {};
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

  // Sender streams into relay in-memory bounded buffer
  server.put<{ Params: { sessionId: string } }>('/api/relay/:sessionId/stream', async (request, reply) => {
    const { sessionId } = request.params;
    const inputStream = (request.body as any) || request.raw;

    try {
      const result = await relayBridge.handleSenderStream(sessionId, inputStream);
      return reply.send({
        success: true,
        sessionId,
        bytesRelayed: result.bytesRelayed,
        finalHash: result.finalHash,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  // Receiver streams out of relay in-memory bounded buffer
  server.get<{ Params: { sessionId: string } }>('/api/relay/:sessionId/stream', async (request, reply) => {
    const { sessionId } = request.params;
    try {
      await relayBridge.handleReceiverStream(sessionId, reply);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  server.get<{ Params: { sessionId: string } }>('/api/relay/:sessionId/status', async (request, reply) => {
    const session = relayBridge.getSession(request.params.sessionId);
    if (!session) {
      return reply.status(404).send({ error: 'Relay session not found or expired' });
    }
    return session;
  });

  await server.listen({ port, host: '0.0.0.0' });
  return server;
}

// If run directly
if (process.argv[1]?.endsWith('relay-server.ts') || process.argv[1]?.endsWith('relay-server.js')) {
  const port = parseInt(process.env.RELAY_PORT || '37825', 10);
  createRelayServer(port).then(() => {
    console.log(`\n⚡ ShareLAN Out-of-Band Standalone Relay running on port ${port}\n`);
  }).catch((err) => {
    console.error('Failed to start standalone relay:', err);
    process.exit(1);
  });
}
