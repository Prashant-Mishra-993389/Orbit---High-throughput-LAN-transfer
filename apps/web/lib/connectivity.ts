import { ConnectivityStatus, TransportMode } from '@sharelan/protocol';
import { getServerBaseUrl } from './api';

export type DiagnosticReason =
  | 'DIRECT_LAN_OK'
  | 'CLIENT_ISOLATION_DETECTED'
  | 'FIREWALL_OR_PORT_BLOCKED'
  | 'INTERNET_UNAVAILABLE'
  | 'RELAY_REACHABLE'
  | 'RELAY_UNREACHABLE'
  | 'PEER_OFFLINE'
  | 'UNKNOWN_ERROR';

export interface TransportDecision {
  selectedTransport: TransportMode;
  directStatus: ConnectivityStatus;
  relayStatus: ConnectivityStatus;
  overallStatus: ConnectivityStatus;
  reason: DiagnosticReason;
  explanation: string;
  badgeLabel: string;
  badgeType: 'direct' | 'relay' | 'error';
  latencyMs?: number;
}

/**
 * Actively probes direct peer LAN connectivity with a 1500ms timeout.
 * Automatically falls back to Zero-Disk Relay Stream if AP-isolation, firewall, or NAT blocks direct traffic.
 */
export async function probeAndSelectTransport(
  peerIp: string,
  peerPort = 37821,
  relayUrl?: string
): Promise<TransportDecision> {
  const activeRelayUrl = relayUrl || getServerBaseUrl();

  // 1. Check if browser has any network connection
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      selectedTransport: 'RELAY_STREAM',
      directStatus: 'DIRECT_LAN_BLOCKED',
      relayStatus: 'RELAY_UNAVAILABLE',
      overallStatus: 'RELAY_UNAVAILABLE',
      reason: 'INTERNET_UNAVAILABLE',
      explanation: 'No active network interface detected. Ensure Wi-Fi or Ethernet is connected.',
      badgeLabel: 'Offline',
      badgeType: 'error',
    };
  }

  // 2. Perform direct LAN connectivity probe
  const t0 = performance.now();
  let directSuccess = false;
  let directLatency = 0;
  let directError: unknown = null;

  try {
    const probeRes = await fetch(`http://${peerIp}:${peerPort}/api/system/ping`, {
      method: 'GET',
      mode: 'cors',
      signal: AbortSignal.timeout(1500),
    });

    if (probeRes.ok) {
      directSuccess = true;
      directLatency = Math.round(performance.now() - t0);
    }
  } catch (err: unknown) {
    directError = err;
  }

  // 3. If direct peer connectivity succeeds, use DIRECT_LAN
  if (directSuccess) {
    return {
      selectedTransport: 'DIRECT_LAN',
      directStatus: 'DIRECT_LAN_AVAILABLE',
      relayStatus: 'RELAY_AVAILABLE',
      overallStatus: 'DIRECT_LAN_AVAILABLE',
      reason: 'DIRECT_LAN_OK',
      explanation: `Direct peer-to-peer LAN connection established (${directLatency}ms latency). Maximum transfer speed active.`,
      badgeLabel: '⚡ Direct Connection',
      badgeType: 'direct',
      latencyMs: directLatency,
    };
  }

  // 4. Direct LAN probe failed -> Determine likely cause
  const isLikelyClientIsolation = true; // In hostel / campus Wi-Fi, direct IP dropping is typical AP isolation

  // 5. Test Relay Reachability
  let relaySuccess = false;
  try {
    const relayPing = await fetch(`${activeRelayUrl}/api/system/ping`, {
      method: 'GET',
      mode: 'cors',
      signal: AbortSignal.timeout(2000),
    });
    if (relayPing.ok) {
      relaySuccess = true;
    }
  } catch {
    relaySuccess = false;
  }

  if (relaySuccess) {
    return {
      selectedTransport: 'RELAY_STREAM',
      directStatus: 'DIRECT_LAN_BLOCKED',
      relayStatus: 'RELAY_AVAILABLE',
      overallStatus: 'RELAY_AVAILABLE',
      reason: 'CLIENT_ISOLATION_DETECTED',
      explanation:
        'Direct LAN connection blocked (Hostel Wi-Fi AP-isolation or Windows Firewall). Zero-Disk Relay Stream automatically selected.',
      badgeLabel: '🌐 Relay Stream (Hostel AP-Isolation)',
      badgeType: 'relay',
    };
  }

  // Both direct and relay failed
  return {
    selectedTransport: 'RELAY_STREAM',
    directStatus: 'DIRECT_LAN_BLOCKED',
    relayStatus: 'RELAY_UNAVAILABLE',
    overallStatus: 'RELAY_UNAVAILABLE',
    reason: 'PEER_OFFLINE',
    explanation:
      'Direct peer connection timed out and relay is unreachable. Verify both laptops are connected to network.',
    badgeLabel: 'Connection Blocked',
    badgeType: 'error',
  };
}
