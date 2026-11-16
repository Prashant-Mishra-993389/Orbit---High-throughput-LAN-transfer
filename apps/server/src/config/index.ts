import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { DEFAULT_PORT, DEFAULT_CHUNK_SIZE, DEFAULT_MAX_CONCURRENT_TRANSFERS } from '@sharelan/protocol';

export interface AppConfig {
  port: number;
  host: string;
  storageDir: string;
  tempDir: string;
  chunkSize: number;
  maxConcurrentTransfers: number;
  logLevel: string;
  isDev: boolean;
}

function resolveDefaultStorageDir(): string {
  if (process.env.DOWNLOAD_DIRECTORY) {
    return path.resolve(process.env.DOWNLOAD_DIRECTORY);
  }

  // Windows priority: check USERPROFILE Downloads
  const userHome = os.homedir();
  const downloadsPath = path.join(userHome, 'Downloads', 'Orbit');
  return downloadsPath;
}

export function loadConfig(): AppConfig {
  const port = parseInt(process.env.PORT || `${DEFAULT_PORT}`, 10);
  const host = process.env.HOST || '0.0.0.0';
  const storageDir = resolveDefaultStorageDir();
  const tempDir = process.env.TEMP_DIRECTORY
    ? path.resolve(process.env.TEMP_DIRECTORY)
    : path.join(storageDir, '.temp');

  const chunkSize = parseInt(process.env.CHUNK_SIZE || `${DEFAULT_CHUNK_SIZE}`, 10);
  const maxConcurrentTransfers = parseInt(
    process.env.MAX_CONCURRENT_TRANSFERS || `${DEFAULT_MAX_CONCURRENT_TRANSFERS}`,
    10
  );
  const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  const isDev = process.env.NODE_ENV !== 'production';

  // Ensure directories exist
  try {
    fs.mkdirSync(storageDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (err) {
    console.error('Failed to initialize storage directories:', err);
  }

  return {
    port,
    host,
    storageDir,
    tempDir,
    chunkSize,
    maxConcurrentTransfers,
    logLevel,
    isDev,
  };
}

export const config = loadConfig();
