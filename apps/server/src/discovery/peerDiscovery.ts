import dgram from 'node:dgram';
import net from 'node:net';
import http from 'node:http';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { DeviceInfo, SHARELAN_PROTOCOL_VERSION } from '@sharelan/protocol';
import { getNetworkDiagnostics } from '../diagnostics/network.js';
import { config } from '../config/index.js';

const DISCOVERY_PORT = 37822;
const BROADCAST_INTERVAL_MS = 5000;
const PEER_TIMEOUT_MS = 25000;

export class PeerDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private timer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private peers = new Map<string, DeviceInfo>();
  private localDeviceId: string;
  private localDeviceName: string;
  private broadcastPort: number = config.port;
  private isSweeping = false;

  constructor() {
    super();
    this.localDeviceId =
      os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Math.floor(Math.random() * 1000);
    this.localDeviceName = os.hostname();
  }

  public setPort(port: number): void {
    this.broadcastPort = port;
  }

  public start(port?: number): void {
    if (port) {
      this.broadcastPort = port;
    }

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString('utf-8'));
          if (data.type === 'sharelan:announce' && data.deviceId !== this.localDeviceId) {
            const peer: DeviceInfo = {
              deviceId: data.deviceId,
              deviceName: data.deviceName || rinfo.address,
              ip: rinfo.address,
              port: data.port || this.broadcastPort,
              os: data.os || 'Unknown',
              protocolVersion: data.protocolVersion || SHARELAN_PROTOCOL_VERSION,
              capabilities: data.capabilities || {
                protocolVersion: SHARELAN_PROTOCOL_VERSION,
                transports: ['http-stream', 'relay'],
                hashAlgorithms: ['sha256'],
                resumable: true,
                maxChunkSize: config.chunkSize,
              },
              pairingState: 'UNPAIRED',
              lastSeen: Date.now(),
            };

            const isNew = !this.peers.has(peer.deviceId);
            this.peers.set(peer.deviceId, peer);

            if (isNew) {
              this.emit('peer:discovered', peer);
            }
          }
        } catch {
          // Ignore malformed datagrams
        }
      });

      this.socket.on('error', (err) => {
        // UDP broadcast might fail on strict networks; handle gracefully
        console.warn('UDP Discovery warning:', err.message);
      });

      this.socket.bind(DISCOVERY_PORT, () => {
        try {
          this.socket?.setBroadcast(true);
        } catch {
          // Broadcast not supported on interface
        }
        this.broadcastPresence();
      });

      this.timer = setInterval(() => this.broadcastPresence(), BROADCAST_INTERVAL_MS);
      this.pruneTimer = setInterval(() => this.pruneStalePeers(), 5000);

      // Trigger initial fast subnet sweep to bypass phone hotspot UDP blocks
      setTimeout(() => {
        this.sweepSubnet().catch(() => {});
      }, 1000);

      // Recurring sweep every 15s if no peers are discovered via UDP
      this.sweepTimer = setInterval(() => {
        if (this.peers.size === 0) {
          this.sweepSubnet().catch(() => {});
        }
      }, 15000);
    } catch (err) {
      console.warn('Could not start UDP discovery:', err);
    }
  }

  private broadcastPresence(): void {
    if (!this.socket) return;
    const diag = getNetworkDiagnostics(this.broadcastPort);
    const payload = Buffer.from(
      JSON.stringify({
        type: 'sharelan:announce',
        deviceId: this.localDeviceId,
        deviceName: this.localDeviceName,
        port: this.broadcastPort,
        os: process.platform === 'win32' ? 'Windows' : process.platform,
        protocolVersion: SHARELAN_PROTOCOL_VERSION,
        ip: diag.localIp,
      })
    );

    // Broadcast to LAN broadcast address
    try {
      this.socket.send(payload, 0, payload.length, DISCOVERY_PORT, '255.255.255.255');
    } catch {
      // Ignore broadcast send errors
    }
  }

  /**
   * Fast Hotspot Subnet Sweeper:
   * When Android/iOS personal hotspots drop UDP broadcast packets, this sweeps
   * the local /24 subnet (254 IPs) concurrently over TCP in <1.2 seconds.
   */
  public async sweepSubnet(targetPort?: number): Promise<DeviceInfo[]> {
    if (this.isSweeping) return this.getDiscoveredPeers();
    this.isSweeping = true;

    const probePort = targetPort || this.broadcastPort;
    const diag = getNetworkDiagnostics(probePort);
    const localIp = diag.localIp;

    if (!localIp || localIp === '127.0.0.1') {
      this.isSweeping = false;
      return this.getDiscoveredPeers();
    }

    const ipParts = localIp.split('.');
    if (ipParts.length !== 4) {
      this.isSweeping = false;
      return this.getDiscoveredPeers();
    }

    const subnetPrefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.`;
    const localLastOctet = parseInt(ipParts[3], 10);
    const foundPeers: DeviceInfo[] = [];

    // Probe an IP address for Orbit presence
    const probeIp = (ip: string): Promise<DeviceInfo | null> => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);

        socket.on('connect', () => {
          socket.destroy();
          // Port is open: verify it's an Orbit server via HTTP ping
          const req = http.get(
            `http://${ip}:${probePort}/api/system/ping`,
            { timeout: 800 },
            (res) => {
              let body = '';
              res.on('data', (c) => (body += c));
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.status === 'ok') {
                    const peer: DeviceInfo = {
                      deviceId: `peer-${ip.replace(/\./g, '-')}`,
                      deviceName: parsed.deviceName || ip,
                      ip,
                      port: probePort,
                      os: 'Desktop',
                      protocolVersion: parsed.protocolVersion || SHARELAN_PROTOCOL_VERSION,
                      capabilities: {
                        protocolVersion: SHARELAN_PROTOCOL_VERSION,
                        transports: ['http-stream', 'relay'],
                        hashAlgorithms: ['sha256'],
                        resumable: true,
                        maxChunkSize: config.chunkSize,
                      },
                      pairingState: 'UNPAIRED',
                      lastSeen: Date.now(),
                    };
                    resolve(peer);
                    return;
                  }
                } catch {}
                resolve(null);
              });
            }
          );
          req.on('error', () => resolve(null));
          req.on('timeout', () => {
            req.destroy();
            resolve(null);
          });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(null);
        });

        socket.on('error', () => {
          socket.destroy();
          resolve(null);
        });

        socket.connect(probePort, ip);
      });
    };

    // Scan all 254 IPs concurrently in batches of 40
    const ipList: string[] = [];
    for (let i = 1; i <= 254; i++) {
      if (i !== localLastOctet) {
        ipList.push(`${subnetPrefix}${i}`);
      }
    }

    const batchSize = 40;
    for (let i = 0; i < ipList.length; i += batchSize) {
      const batch = ipList.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((ip) => probeIp(ip)));
      for (const peer of results) {
        if (peer) {
          foundPeers.push(peer);
          const isNew = !this.peers.has(peer.deviceId);
          this.peers.set(peer.deviceId, peer);
          if (isNew) {
            this.emit('peer:discovered', peer);
          }
        }
      }
    }

    this.isSweeping = false;
    return this.getDiscoveredPeers();
  }

  private pruneStalePeers(): void {
    const now = Date.now();
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
        this.peers.delete(id);
        this.emit('peer:lost', { deviceId: id });
      }
    }
  }

  public getDiscoveredPeers(): DeviceInfo[] {
    return Array.from(this.peers.values());
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }
}

export const peerDiscovery = new PeerDiscovery();
