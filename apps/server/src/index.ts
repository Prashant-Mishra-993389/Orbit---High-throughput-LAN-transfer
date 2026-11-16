import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { apiRoutes } from './api/routes.js';
import { registerWebSocketRoutes } from './websocket/server.js';
import { getNetworkDiagnostics } from './diagnostics/network.js';
import { peerDiscovery } from './discovery/peerDiscovery.js';
import { tunnelManager } from './tunnel/TunnelManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  autoTunnel?: boolean;
  webDistPath?: string;
}

export interface RunningServer {
  server: FastifyInstance;
  port: number;
  host: string;
  stop: () => Promise<void>;
}

let currentRunningServer: RunningServer | null = null;

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const targetPort = options.port || config.port;
  const targetHost = options.host || config.host;
  const autoTunnel = options.autoTunnel !== undefined ? options.autoTunnel : true;

  const server = Fastify({
    logger: {
      level: config.logLevel,
    },
    bodyLimit: 100 * 1024 * 1024 * 1024, // 100 GB limit for multi-GB streaming transfers
  });

  // CORS for LAN and web access
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Enable raw stream passthrough for any content-type without buffering
  server.addContentTypeParser('*', (_request, payload, done) => {
    done(null, payload);
  });

  // WebSocket support
  await server.register(fastifyWebsocket);
  await registerWebSocketRoutes(server);

  // Register API routes
  await server.register(apiRoutes);

  // Serve Next.js exported static web UI
  const webDistPath = options.webDistPath || path.resolve(__dirname, '../../web/out');
  if (fs.existsSync(webDistPath)) {
    await server.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });

    server.setNotFoundHandler((req, reply) => {
      const url = req.raw.url || '';
      if (url.startsWith('/api')) {
        reply.status(404).send({ error: 'API route not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  // Start listening
  await server.listen({
    port: targetPort,
    host: targetHost,
  });

  // Configure underlying Node.js HTTP server for multi-GB streaming transfers
  server.server.requestTimeout = 0; // Disable Node.js 5-minute timeout
  server.server.headersTimeout = 0;
  server.server.keepAliveTimeout = 120000;

  // Get actual assigned port (in case port 0 was passed for dynamic allocation)
  const addressInfo = server.server.address();
  const actualPort = typeof addressInfo === 'object' && addressInfo ? addressInfo.port : targetPort;

  // Start LAN UDP Peer Discovery
  try {
    peerDiscovery.start();
  } catch (err) {
    console.warn('UDP Peer discovery warning:', err);
  }

  // Auto-start Public Tunnel if requested
  if (autoTunnel) {
    tunnelManager.start(actualPort).then((url) => {
      console.log(` ▸ Public Hostel URL: ${url}`);
    }).catch((err) => {
      console.warn('Note: Cloudflare tunnel could not be started automatically:', err.message);
    });
  }

  const diag = getNetworkDiagnostics(actualPort);
  console.log('\n======================================================');
  console.log('   🚀 Orbit Streaming Server Started Successfully');
  console.log('======================================================');
  console.log(` ▸ Local URL:       http://localhost:${actualPort}`);
  console.log(` ▸ LAN Direct URL:  http://${diag.localIp}:${actualPort}`);
  console.log(` ▸ Storage Dir:     ${config.storageDir}`);
  console.log('======================================================\n');

  const stop = async () => {
    try {
      peerDiscovery.stop();
    } catch {}
    try {
      tunnelManager.stop();
    } catch {}
    await server.close();
    currentRunningServer = null;
  };

  currentRunningServer = {
    server,
    port: actualPort,
    host: targetHost,
    stop,
  };

  return currentRunningServer;
}

export async function stopServer(): Promise<void> {
  if (currentRunningServer) {
    await currentRunningServer.stop();
  }
}

// If run directly from CLI
const isDirectRun =
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js') ||
  process.env.SHARELAN_CLI_RUN === 'true';

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  const shutdown = async () => {
    console.log('\nShutting down Orbit gracefully...');
    await stopServer();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
