import {
  TransferSession,
  TransferOffer,
  NetworkDiagnostics,
  DeviceCapabilities,
  DeviceInfo,
  PairingSession,
  TransportMode,
} from '@sharelan/protocol';

export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:37821';
  if ((window as any).electronAPI?.getServerUrl) {
    return (window as any).electronAPI.getServerUrl();
  }
  if (window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:37821`;
  }
  return window.location.origin;
}

export function getWebSocketUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:37821/ws';
  if ((window as any).electronAPI?.getWsUrl) {
    return (window as any).electronAPI.getWsUrl();
  }
  const isSecure = window.location.protocol === 'https:';
  const proto = isSecure ? 'wss:' : 'ws:';
  if (window.location.port === '3000') {
    return `${proto}//${window.location.hostname}:37821/ws`;
  }
  return `${proto}//${window.location.host}/ws`;
}

export function formatUserFriendlyError(err: unknown): string {
  if (!err) return 'Transfer was interrupted.';
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('ECONNRESET') || message.includes('interrupted') || message.includes('connection failed')) {
    return 'Connection lost. The other device may have disconnected or switched networks.';
  }
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return 'Connection timed out. Ensure both laptops are awake and connected.';
  }
  if (message.includes('aborted') || message.includes('cancelled')) {
    return 'Transfer was cancelled.';
  }
  if (message.includes('404')) {
    return 'Transfer session expired. Please send again.';
  }
  return message;
}

export async function fetchNetworkDiagnostics(): Promise<NetworkDiagnostics> {
  const res = await fetch(`${getServerBaseUrl()}/api/system/network`);
  if (!res.ok) throw new Error('Failed to fetch network diagnostics');
  return res.json();
}

export async function fetchCapabilities(): Promise<DeviceCapabilities> {
  const res = await fetch(`${getServerBaseUrl()}/api/capabilities`);
  if (!res.ok) throw new Error('Failed to fetch capabilities');
  return res.json();
}

export async function fetchDevices(): Promise<DeviceInfo[]> {
  const res = await fetch(`${getServerBaseUrl()}/api/devices`);
  if (!res.ok) throw new Error('Failed to fetch discovered devices');
  return res.json();
}

/**
 * Triggers a fast parallel subnet sweep on the server to discover
 * peers on mobile hotspots where UDP broadcasts are blocked.
 */
export async function triggerSubnetSweep(): Promise<DeviceInfo[]> {
  const res = await fetch(`${getServerBaseUrl()}/api/discovery/sweep`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to sweep subnet');
  const data = await res.json();
  return data.peers || [];
}

export async function testPeerConnectivity(ip: string, port = 37821): Promise<{
  directLanAvailable: boolean;
  status: 'DIRECT_LAN_AVAILABLE' | 'DIRECT_LAN_BLOCKED';
  note: string;
}> {
  const res = await fetch(`${getServerBaseUrl()}/api/system/test-peer-connectivity?ip=${encodeURIComponent(ip)}&port=${port}`);
  if (!res.ok) throw new Error('Failed to test peer connectivity');
  return res.json();
}

export async function fetchTransfers(): Promise<TransferSession[]> {
  const res = await fetch(`${getServerBaseUrl()}/api/transfers`);
  if (!res.ok) throw new Error('Failed to fetch transfers');
  return res.json();
}

export async function fetchOffers(): Promise<TransferOffer[]> {
  const res = await fetch(`${getServerBaseUrl()}/api/transfers/offers`);
  if (!res.ok) throw new Error('Failed to fetch transfer offers');
  return res.json();
}

/**
 * Creates an Outbound Transfer Offer (Real-Time Live Share).
 * Initializes an in-memory stream bridge. Zero bytes written to sender disk!
 */
export async function createTransferOffer(params: {
  transferId?: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  expectedHash?: string;
  senderClientId: string;
  senderDeviceName: string;
  targetDeviceId?: string;
  targetClientId?: string;
  targetHost?: string;
  transportMode?: TransportMode;
  relaySessionId?: string;
  e2eeSecret?: string;
}): Promise<TransferOffer> {
  const localBase = getServerBaseUrl();
  const res = await fetch(`${localBase}/api/transfers/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to create transfer offer');
  const offer: TransferOffer = await res.json();

  // If a specific remote peer is targeted on the network, forward the offer to their server directly
  if (params.targetHost && params.targetHost !== localBase) {
    try {
      await fetch(`${params.targetHost}/api/transfers/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offer),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      console.warn('Could not forward offer directly to peer server:', err);
    }
  }

  return offer;
}

/**
 * Accept an incoming transfer offer
 */
export async function acceptTransferOffer(
  transferId: string,
  receiverInfo?: { receiverClientId?: string; receiverDeviceName?: string; receiverDeviceId?: string },
  targetHost?: string
): Promise<{ success: boolean }> {
  const localBase = getServerBaseUrl();
  const host = targetHost || localBase;

  const res = await fetch(`${host}/api/transfers/${transferId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(receiverInfo || {}),
  });

  if (targetHost && targetHost !== localBase) {
    try {
      await fetch(`${localBase}/api/transfers/${transferId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiverInfo || {}),
        signal: AbortSignal.timeout(1500),
      });
    } catch {}
  }

  if (!res.ok) throw new Error('Failed to accept transfer offer');
  return res.json();
}

/**
 * Reject an incoming transfer offer
 */
export async function rejectTransferOffer(
  transferId: string,
  reason?: string,
  targetHost?: string
): Promise<{ success: boolean }> {
  const localBase = getServerBaseUrl();
  const host = targetHost || localBase;

  const res = await fetch(`${host}/api/transfers/${transferId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (targetHost && targetHost !== localBase) {
    try {
      await fetch(`${localBase}/api/transfers/${transferId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {}
  }

  if (!res.ok) throw new Error('Failed to reject transfer offer');
  return res.json();
}

/**
 * Check partial offset for resumable transfers
 */
export async function getTransferOffset(transferId: string): Promise<number> {
  try {
    const res = await fetch(`${getServerBaseUrl()}/api/transfers/${transferId}/offset`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.offset || 0;
  } catch {
    return 0;
  }
}

/**
 * Sender streams live file bytes directly into the in-memory stream bridge.
 * The bytes are piped in real time to the receiver as they arrive.
 * ZERO duplicate file is created on the sender machine.
 */
export function streamFileToBridge(
  transferId: string,
  file: File,
  onProgress?: (bytesUploaded: number, totalBytes: number) => void
): Promise<{ success: boolean; finalHash: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${getServerBaseUrl()}/api/transfers/${transferId}/live-pipe`;

    xhr.open('PUT', url, true);
    xhr.timeout = 0; // Disable client timeout for multi-GB transfers
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve({ success: true, finalHash: '' });
        }
      } else {
        reject(new Error(`Live stream failed with HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network connection interrupted during live streaming'));
    xhr.onabort = () => reject(new Error('Transfer aborted'));

    // Streams file directly from disk with native backpressure
    xhr.send(file);
  });
}

/**
 * Direct App-to-App Push: Laptop A streams directly to Laptop B's server using canonical transferId.
 * Laptop B streams directly to Laptop B's disk as .sharelan.part.
 * Laptop A creates ZERO duplicate files.
 */
export async function pushFileToPeer(
  peerIp: string,
  peerPort: number,
  transferId: string,
  file: File,
  resumeOffset = 0,
  onProgress?: (bytesUploaded: number, totalBytes: number) => void
): Promise<{ success: boolean; finalHash: string }> {
  const targetBase = `http://${peerIp}:${peerPort}`;

  // If starting fresh, initialize inbound session on recipient's server with matching transferId
  if (resumeOffset === 0) {
    const initRes = await fetch(`${targetBase}/api/transfers/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      }),
    });

    if (!initRes.ok) {
      throw new Error(`Recipient rejected transfer initialization (HTTP ${initRes.status})`);
    }
  }

  // Slice file if resuming
  const fileSlice = resumeOffset > 0 ? file.slice(resumeOffset) : file;

  // Stream directly into recipient's server
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${targetBase}/api/transfers/${transferId}/stream`, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    if (resumeOffset > 0) {
      xhr.setRequestHeader('X-Resume-Offset', resumeOffset.toString());
    }

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(resumeOffset + event.loaded, file.size);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({ success: true, finalHash: '' });
        }
      } else {
        reject(new Error(`Peer streaming failed with HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Direct connection to peer failed'));
    xhr.send(fileSlice);
  });
}

/**
 * Zero-Disk Relay Stream: Sender streams directly into relay memory buffer.
 * Relayed immediately to recipient with bounded 64KB backpressure.
 * ZERO bytes stored on relay server disk!
 */
export function streamFileToRelay(
  sessionId: string,
  file: File,
  onProgress?: (bytesUploaded: number, totalBytes: number) => void
): Promise<{ success: boolean; finalHash: string; bytesRelayed: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${getServerBaseUrl()}/api/relay/${sessionId}/stream`;

    xhr.open('PUT', url, true);
    xhr.timeout = 0; // Disable client timeout for multi-GB transfers
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({ success: true, finalHash: '', bytesRelayed: file.size });
        }
      } else {
        reject(new Error(`Relay stream failed with HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Relay stream network connection interrupted'));
    xhr.onabort = () => reject(new Error('Relay transfer aborted'));

    xhr.send(file);
  });
}

/**
 * Trigger native browser streaming download directly to recipient disk.
 * The browser's native download manager streams chunks straight from socket to disk,
 * requiring ZERO JavaScript memory (unlimited file size: 1GB, 5GB, 50GB+).
 */
export function triggerBrowserStreamDownload(streamUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = streamUrl;
  a.setAttribute('download', fileName);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {}
  }, 2000);
}

/**
 * Stream chunks directly into a FileSystemFileHandle selected by the user.
 * Each 64 KiB chunk is written immediately to disk with ZERO RAM retention.
 */
export async function streamDirectToFileHandle(
  streamUrl: string,
  fileHandle: any,
  onProgress?: (loaded: number) => void
): Promise<{ bytesReceived: number }> {
  const response = await fetch(streamUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to connect to stream (HTTP ${response.status})`);
  }

  const writable = await fileHandle.createWritable();
  const reader = response.body.getReader();
  let loaded = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await writable.write(value);
        loaded += value.length;
        if (onProgress) onProgress(loaded);
      }
    }
    await writable.close();
    return { bytesReceived: loaded };
  } catch (err) {
    try {
      await writable.abort(err);
    } catch {}
    throw err;
  }
}

/**
 * Stream consumer that does NOT exhaust browser heap.
 * If fileHandle is passed, streams directly to disk handle.
 * Otherwise, triggers native browser download engine straight to disk.
 */
export async function consumeIncomingStream(
  streamUrl: string,
  fileName: string,
  onProgress?: (loaded: number) => void,
  fileHandle?: any
): Promise<{ calculatedHash: string; bytesReceived: number }> {
  if (fileHandle) {
    const result = await streamDirectToFileHandle(streamUrl, fileHandle, onProgress);
    return { calculatedHash: '', bytesReceived: result.bytesReceived };
  }

  // Trigger native browser download directly from stream
  triggerBrowserStreamDownload(streamUrl, fileName);
  return { calculatedHash: '', bytesReceived: 0 };
}


export async function cancelTransfer(transferId: string, targetHost?: string): Promise<void> {
  const localBase = getServerBaseUrl();
  const host = targetHost || localBase;

  const res = await fetch(`${host}/api/transfers/${transferId}`, {
    method: 'DELETE',
  });

  if (targetHost && targetHost !== localBase) {
    try {
      await fetch(`${localBase}/api/transfers/${transferId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(1500),
      });
    } catch {}
  }

  if (!res.ok && res.status !== 404) throw new Error('Failed to cancel transfer');
}

/**
 * 6-Digit Pairing: Create Host Session
 */
export async function createPairingSession(
  hostClientId: string,
  hostDeviceName?: string
): Promise<PairingSession> {
  const res = await fetch(`${getServerBaseUrl()}/api/pairing/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostClientId, hostDeviceName }),
  });
  if (!res.ok) throw new Error('Failed to create pairing session');
  return res.json();
}

/**
 * 6-Digit Pairing: Guest Joins Session
 */
export async function joinPairingSession(
  code: string,
  guestClientId: string,
  guestDeviceName?: string
): Promise<{ success: boolean; session: PairingSession; sharedSecret: string }> {
  const res = await fetch(`${getServerBaseUrl()}/api/pairing/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, guestClientId, guestDeviceName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to join pairing session');
  }
  return res.json();
}

/**
 * Instant QR-code Auto Connect: Guest connects immediately to Host
 */
export async function autoConnectPairing(params: {
  hostClientId: string;
  guestClientId: string;
  guestDeviceName?: string;
  hostDeviceName?: string;
}): Promise<{ success: boolean; session: PairingSession }> {
  const res = await fetch(`${getServerBaseUrl()}/api/pairing/auto-connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to auto-connect with host');
  }
  return res.json();
}

/**
 * 6-Digit Pairing: Get Status
 */
export async function getPairingStatus(code: string): Promise<PairingSession> {
  const res = await fetch(`${getServerBaseUrl()}/api/pairing/${encodeURIComponent(code)}/status`);
  if (!res.ok) throw new Error('Pairing session not found or expired');
  return res.json();
}

/**
 * Runs synthetic network benchmark to determine pure TCP capacity
 */
export async function runSyntheticBenchmark(sizeBytes = 25 * 1024 * 1024): Promise<{
  speedFormatted: string;
  speedBytesPerSec: number;
  durationSec: number;
}> {
  const chunk = new Uint8Array(64 * 1024);
  const blob = new Blob(new Array(Math.floor(sizeBytes / (64 * 1024))).fill(chunk));

  const t0 = performance.now();
  const res = await fetch(`${getServerBaseUrl()}/api/system/benchmark-upload`, {
    method: 'POST',
    body: blob,
  });

  if (!res.ok) throw new Error('Benchmark failed');
  const elapsedSec = (performance.now() - t0) / 1000;
  const actualSpeed = sizeBytes / Math.max(0.001, elapsedSec);

  return {
    speedFormatted: `${(actualSpeed / (1024 * 1024)).toFixed(2)} MiB/s`,
    speedBytesPerSec: actualSpeed,
    durationSec: elapsedSec,
  };
}

