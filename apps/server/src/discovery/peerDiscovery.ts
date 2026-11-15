import dgram from 'node:dgram';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { DeviceInfo, SHARELAN_PROTOCOL_VERSION } from '@sharelan/protocol';
import { getNetworkDiagnostics } from '../diagnostics/network.js';
import { config } from '../config/index.js';

const DISCOVERY_PORT = 37822;
const BROADCAST_INTERVAL_MS = 5000;
const PEER_TIMEOUT_MS = 15000;

export class PeerDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private timer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;
  private peers = new Map<string, DeviceInfo>();
  private localDeviceId: string;
  private localDeviceName: string;

  constructor() {
    super();
    this.localDeviceId = os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
    this.localDeviceName = os.hostname();
  }

  public start(): void {
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
              port: data.port || config.port,
              os: data.os || 'Unknown',
              protocolVersion: data.protocolVersion || SHARELAN_PROTOCOL_VERSION,
              capabilities: data.capabilities || {
                protocolVersion: SHARELAN_PROTOCOL_VERSION,
                transports: ['http-stream'],
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
    } catch (err) {
      console.warn('Could not start UDP discovery:', err);
    }
  }

  private broadcastPresence(): void {
    if (!this.socket) return;
    const diag = getNetworkDiagnostics(config.port);
    const payload = Buffer.from(
      JSON.stringify({
        type: 'sharelan:announce',
        deviceId: this.localDeviceId,
        deviceName: this.localDeviceName,
        port: config.port,
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
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }
}

export const peerDiscovery = new PeerDiscovery();
