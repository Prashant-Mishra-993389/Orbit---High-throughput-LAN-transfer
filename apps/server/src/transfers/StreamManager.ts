import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';
import { config } from '../config/index.js';
import { transferManager } from './TransferManager.js';
import { getUniqueDestinationPath } from '../security/sanitizer.js';

export interface StreamTransferResult {
  transferId: string;
  bytesTransferred: number;
  finalHash: string;
  finalFilePath: string;
}

export class StreamManager {
  /**
   * Check if a partial .sharelan.part file exists and return its verified byte length for resumption.
   */
  public static async getPartialOffset(transferId: string): Promise<number> {
    const tempFileName = `${transferId}.sharelan.part`;
    const tempFilePath = path.join(config.tempDir, tempFileName);
    try {
      const stat = await fsPromises.stat(tempFilePath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  /**
   * Streams an incoming readable stream (HTTP request body) directly into a temporary file,
   * calculating SHA-256 on the fly with backpressure, and atomically moves to destination upon verification.
   *
   * Zero duplicate copy on sender; zero intermediate full-file buffering on receiver.
   */
  public static async handleIncomingStream(
    transferId: string,
    inputStream: Readable,
    options?: { resumeOffset?: number }
  ): Promise<StreamTransferResult> {
    const session = transferManager.getSession(transferId);
    if (!session) {
      throw new Error(`Transfer session ${transferId} not found`);
    }

    // Temporary staging path: config.tempDir / transferId.sharelan.part
    const tempFileName = `${transferId}.sharelan.part`;
    const tempFilePath = path.join(config.tempDir, tempFileName);

    const isResuming = (options?.resumeOffset || 0) > 0;
    let initialBytes = 0;

    const hasher = crypto.createHash('sha256');

    if (isResuming) {
      try {
        const stat = await fsPromises.stat(tempFilePath);
        initialBytes = stat.size;
        // Hash existing portion for cumulative verification
        const existingData = await fsPromises.readFile(tempFilePath);
        hasher.update(existingData);
      } catch {
        initialBytes = 0;
      }
    }

    transferManager.startTransferring(transferId, tempFilePath);

    let totalBytesReceived = initialBytes;

    // Transform stream that counts bytes, computes hash, and updates transfer progress without buffering payload
    const progressTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        totalBytesReceived += chunk.length;
        hasher.update(chunk);
        transferManager.recordStreamBytes(transferId, totalBytesReceived);
        callback(null, chunk);
      },
    });

    const fileWriteStream = fs.createWriteStream(tempFilePath, {
      flags: isResuming ? 'a' : 'w',
      highWaterMark: 64 * 1024, // 64 KiB I/O buffer to balance throughput and memory
    });

    try {
      // Use node:stream/promises pipeline to handle proper backpressure and stream completion/errors
      await pipeline(inputStream, progressTransform, fileWriteStream);

      // Verify and finalize
      transferManager.markVerifying(transferId);
      const calculatedHash = hasher.digest('hex');

      // Check integrity if sender provided expected hash
      if (session.expectedHash && session.expectedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
        await fsPromises.unlink(tempFilePath).catch(() => {});
        const err = `SHA-256 integrity mismatch: expected ${session.expectedHash}, calculated ${calculatedHash}`;
        transferManager.markFailed(transferId, err);
        throw new Error(err);
      }

      // Safe atomic destination
      const finalFilePath = await getUniqueDestinationPath(config.storageDir, session.fileName);

      // Atomic rename (pipeline guarantees writeStream is closed and flushed)
      await fsPromises.rename(tempFilePath, finalFilePath);

      transferManager.markCompleted(transferId, calculatedHash, finalFilePath);

      return {
        transferId,
        bytesTransferred: totalBytesReceived,
        finalHash: calculatedHash,
        finalFilePath,
      };
    } catch (err: unknown) {
      // Only delete temporary file if not resumable or error occurred on clean start
      if (!isResuming) {
        await fsPromises.unlink(tempFilePath).catch(() => {});
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      transferManager.markFailed(transferId, errorMsg);
      throw err;
    }
  }
}
