/**
 * ShareLAN Protocol Specifications v1.0
 */

export const SHARELAN_PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_PORT = 37821;
export const DEFAULT_CHUNK_SIZE = 64 * 1024 * 1024; // 64 MiB
export const DEFAULT_MAX_CONCURRENT_TRANSFERS = 4;
export const PROGRESS_THROTTLE_MS = 100; // 10 FPS updates max to prevent UI stutter

/**
 * Authoritative Canonical Transfer State Machine
 *
 * CREATED -> OFFERED -> ACCEPTED -> CONNECTING -> TRANSFERRING -> VERIFYING -> COMPLETED
 * Terminal/Error: REJECTED | CANCELLED | FAILED | PAUSED
 */
export type TransferStatus =
  | 'CREATED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'TRANSFERRING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PAUSED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED';

export type TransferRole = 'sender' | 'receiver';
export type TransferDirection = 'INCOMING' | 'OUTGOING';
export type TransferMode = 'DIRECT_PUSH' | 'WEB_PULL' | 'RELAY';
export type TransportMode = 'DIRECT_LAN' | 'RELAY_STREAM';
export type ConnectivityStatus =
  | 'DIRECT_LAN_AVAILABLE'
  | 'DIRECT_LAN_BLOCKED'
  | 'RELAY_AVAILABLE'
  | 'RELAY_UNAVAILABLE'
  | 'UNKNOWN';

export interface PairingSession {
  code: string; // 6-digit e.g. "482-195"
  hostClientId: string;
  hostDeviceName: string;
  hostIp: string;
  hostPort: number;
  guestClientId?: string;
  guestDeviceName?: string;
  guestIp?: string;
  guestPort?: number;
  createdAt: number;
  expiresAt: number;
  status: 'WAITING' | 'PAIRED' | 'EXPIRED';
}

export interface TransferMetadata {
  transferId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  lastModified?: number;
  chunkSize: number;
  expectedHash?: string;
  senderDeviceId?: string;
  senderDeviceName?: string;
  receiverDeviceId?: string;
  receiverDeviceName?: string;
}

export interface TransferOffer {
  transferId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  senderClientId: string;
  senderDeviceId: string;
  senderDeviceName: string;
  senderIp: string;
  senderPort?: number;
  targetDeviceId?: string;
  targetClientId?: string;
  receiverDeviceId?: string;
  receiverClientId?: string;
  receiverDeviceName?: string;
  transportMode?: TransportMode;
  relaySessionId?: string;
  expectedHash?: string;
  e2eeSecret?: string;
  status: TransferStatus;
  createdAt: number;
}

export interface TransferSession extends TransferMetadata {
  role?: TransferRole;
  direction: TransferDirection;
  mode?: TransferMode;
  transportMode?: TransportMode;
  status: TransferStatus;
  bytesTransferred: number;
  verifiedOffset: number;
  currentSpeed: number; // bytes per second (rolling window)
  averageSpeed: number; // bytes per second (cumulative)
  etaSeconds: number;
  percentage: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
  finalHash?: string;
  tempFilePath?: string;
  finalFilePath?: string;
  resumable?: boolean;
}

export interface ProgressPayload {
  transferId: string;
  role?: TransferRole;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  currentSpeed: number;
  averageSpeed: number;
  etaSeconds: number;
  status: TransferStatus;
  transportMode?: TransportMode;
  error?: string;
  timestamp: number;
}

export interface DeviceCapabilities {
  protocolVersion: string;
  transports: string[];
  hashAlgorithms: string[];
  resumable: boolean;
  maxChunkSize: number;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
  os: string;
  protocolVersion: string;
  capabilities: DeviceCapabilities;
  pairingState: 'UNPAIRED' | 'PENDING' | 'PAIRED';
  lastSeen: number;
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  netmask: string;
  family: 'IPv4' | 'IPv6';
  mac: string;
  internal: boolean;
  isPreferred: boolean;
}

export interface NetworkDiagnostics {
  selectedInterface: NetworkInterfaceInfo | null;
  interfaces: NetworkInterfaceInfo[];
  localIp: string;
  port: number;
  directLanStatus: 'AVAILABLE' | 'BLOCKED' | 'UNKNOWN' | 'RELAY_REQUIRED';
  observedThroughputBytesPerSec?: number;
  publicTunnelUrl?: string;
}

export type ControlMessage =
  | { type: 'device:presence'; payload: DeviceInfo }
  | { type: 'device:offline'; payload: { deviceId: string } }
  | { type: 'pairing:request'; payload: { deviceId: string; deviceName: string; token: string } }
  | { type: 'pairing:response'; payload: { accepted: boolean; message?: string } }
  | { type: 'transfer:offer'; payload: TransferOffer }
  | { type: 'transfer:accept'; payload: { transferId: string; receiverDeviceId?: string; receiverDeviceName?: string; receiverClientId?: string } }
  | { type: 'transfer:accepted'; payload: { transferId: string; receiverDeviceId?: string; receiverDeviceName?: string; receiverClientId?: string; transportMode?: TransportMode } }
  | { type: 'transfer:reject'; payload: { transferId: string; reason?: string } }
  | { type: 'transfer:cancelled'; payload: { transferId: string; reason?: string } }
  | { type: 'transfer:stream_ready'; payload: { transferId: string; streamUrl: string } }
  | { type: 'transfer:created'; payload: TransferSession }
  | { type: 'transfer:progress'; payload: ProgressPayload }
  | { type: 'transfer:state_change'; payload: { transferId: string; status: TransferStatus; error?: string } }
  | { type: 'transfer:completed'; payload: { transferId: string; finalHash: string; fileName: string; bytesTransferred?: number } }
  | { type: 'pairing:created'; payload: PairingSession }
  | { type: 'pairing:matched'; payload: PairingSession }
  | { type: 'pairing:expired'; payload: { code: string } }
  | { type: 'network:diagnostics'; payload: NetworkDiagnostics };
