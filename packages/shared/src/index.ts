/**
 * Format bytes to human readable binary unit (KiB, MiB, GiB, TiB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm))} ${sizes[safeIndex]}`;
}

/**
 * Format transfer speed (e.g. 112.5 MiB/s)
 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0 || !Number.isFinite(bytesPerSec)) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format duration in seconds to human readable string (e.g. "2m 15s" or "45s")
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) {
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

/**
 * Calculate estimated time of arrival in seconds
 */
export function calculateETA(totalBytes: number, transferredBytes: number, speedBytesPerSec: number): number {
  if (speedBytesPerSec <= 0 || transferredBytes >= totalBytes) return 0;
  const remainingBytes = totalBytes - transferredBytes;
  return remainingBytes / speedBytesPerSec;
}

/**
 * Cross-platform and browser-safe filename sanitizer.
 * Strips directory separators, illegal Windows characters: < > : " / \ | ? *
 * Protects against reserved DOS device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 * Zero Node native dependencies.
 */
export function sanitizeFilename(inputName: string): string {
  if (!inputName || typeof inputName !== 'string') {
    return 'unnamed_file';
  }

  // Extract basename without requiring node:path
  const baseParts = inputName.trim().split(/[/\\]/);
  const base = baseParts[baseParts.length - 1] || 'unnamed_file';

  // Replace illegal chars: control chars (0-31), < > : " / \ | ? *
  // eslint-disable-next-line no-control-regex
  let sanitized = base.replace(/[\x00-\x1f<>:"/\\|?*]/g, '_');

  // Strip trailing dots and spaces (Windows restriction)
  sanitized = sanitized.replace(/[. ]+$/, '');

  // Check for reserved Windows filenames
  const reservedRegex = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reservedRegex.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  // If empty after sanitization
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    sanitized = 'unnamed_file';
  }

  // Truncate length if name is overly long (>240 chars)
  if (sanitized.length > 240) {
    const dotIndex = sanitized.lastIndexOf('.');
    const ext = dotIndex > 0 ? sanitized.substring(dotIndex) : '';
    const nameWithoutExt = dotIndex > 0 ? sanitized.substring(0, dotIndex) : sanitized;
    const maxNameLen = Math.max(1, 230 - ext.length);
    sanitized = `${nameWithoutExt.substring(0, maxNameLen)}${ext}`;
  }

  return sanitized;
}

/**
 * Rolling window throughput calculator.
 * Avoids single-interval spikes and produces smooth, accurate current & average speeds.
 */
export interface SpeedSample {
  bytes: number;
  timestamp: number;
}

export class ThroughputCalculator {
  private samples: SpeedSample[] = [];
  private windowDurationMs: number;
  private startTime: number;
  private totalBytesTransferred = 0;

  constructor(windowDurationMs = 3000) {
    this.windowDurationMs = windowDurationMs;
    this.startTime = Date.now();
  }

  public recordProgress(bytesTransferred: number, now = Date.now()): void {
    this.totalBytesTransferred = bytesTransferred;
    this.samples.push({ bytes: bytesTransferred, timestamp: now });

    // Prune samples older than the rolling window
    const cutoff = now - this.windowDurationMs;
    while (this.samples.length > 1 && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }
  }

  /**
   * Get instantaneous rolling speed in bytes/sec
   */
  public getCurrentSpeed(now = Date.now()): number {
    if (this.samples.length < 2) return 0;

    const oldest = this.samples[0];
    const newest = this.samples[this.samples.length - 1];
    const timeDeltaSec = (newest.timestamp - oldest.timestamp) / 1000;

    if (timeDeltaSec <= 0.05) return 0;
    const bytesDelta = newest.bytes - oldest.bytes;
    return Math.max(0, bytesDelta / timeDeltaSec);
  }

  /**
   * Get overall average speed since transfer began in bytes/sec
   */
  public getAverageSpeed(now = Date.now()): number {
    const elapsedSec = (now - this.startTime) / 1000;
    if (elapsedSec <= 0.1) return 0;
    return Math.max(0, this.totalBytesTransferred / elapsedSec);
  }

  public reset(): void {
    this.samples = [];
    this.startTime = Date.now();
    this.totalBytesTransferred = 0;
  }
}

export * from './crypto.js';

