import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { TransferManager } from '../src/transfers/TransferManager.js';
import { StreamManager } from '../src/transfers/StreamManager.js';
import { getUniqueDestinationPath } from '../src/security/sanitizer.js';
import { config } from '../src/config/index.js';
describe('Server Transfer Engine', () => {
    const testDir = path.join(process.cwd(), 'tests-scratch');
    const tempDir = path.join(testDir, '.temp');
    before(async () => {
        await fs.mkdir(testDir, { recursive: true });
        await fs.mkdir(tempDir, { recursive: true });
        // Point config to test directory
        config.storageDir = testDir;
        config.tempDir = tempDir;
    });
    after(async () => {
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => { });
    });
    it('manages transfer state transitions and progress accounting', () => {
        const manager = new TransferManager();
        const session = manager.createSession({
            fileName: 'test.mp4',
            fileSize: 1000,
        });
        assert.equal(session.fileName, 'test.mp4');
        assert.equal(session.status, 'CREATED');
        manager.startTransferring(session.transferId, '/tmp/staging.part');
        const updated = manager.getSession(session.transferId);
        assert.equal(updated?.status, 'TRANSFERRING');
        manager.recordStreamBytes(session.transferId, 500);
        const progressSession = manager.getSession(session.transferId);
        assert.equal(progressSession?.bytesTransferred, 500);
        assert.equal(progressSession?.percentage, 50);
        manager.markCompleted(session.transferId, 'hash123', '/tmp/final.mp4');
        const completedSession = manager.getSession(session.transferId);
        assert.equal(completedSession?.status, 'COMPLETED');
        assert.equal(completedSession?.percentage, 100);
    });
    it('streams payload with on-the-fly SHA-256 calculation and atomic finalization', async () => {
        // Generate a 1 MB payload buffer
        const buffer = Buffer.alloc(1024 * 1024);
        for (let i = 0; i < buffer.length; i++)
            buffer[i] = i % 256;
        const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');
        const session = (await import('../src/transfers/TransferManager.js')).transferManager.createSession({
            fileName: 'stream_test.bin',
            fileSize: buffer.length,
            expectedHash,
        });
        // Create a readable stream from buffer
        const readable = Readable.from([buffer]);
        // Stream into server StreamManager
        const result = await StreamManager.handleIncomingStream(session.transferId, readable);
        assert.equal(result.bytesTransferred, buffer.length);
        assert.equal(result.finalHash, expectedHash);
        // Verify file exists on disk at finalFilePath
        const stat = await fs.stat(result.finalFilePath);
        assert.equal(stat.size, buffer.length);
        // Verify content on disk
        const diskContent = await fs.readFile(result.finalFilePath);
        const diskHash = crypto.createHash('sha256').update(diskContent).digest('hex');
        assert.equal(diskHash, expectedHash);
    });
    it('rejects corrupted stream with hash mismatch and cleans up temporary file', async () => {
        const buffer = Buffer.from('actual content payload');
        const wrongHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        const session = (await import('../src/transfers/TransferManager.js')).transferManager.createSession({
            fileName: 'corrupted_test.bin',
            fileSize: buffer.length,
            expectedHash: wrongHash,
        });
        const readable = Readable.from([buffer]);
        await assert.rejects(async () => {
            await StreamManager.handleIncomingStream(session.transferId, readable);
        }, /SHA-256 integrity mismatch/);
        const failedSession = (await import('../src/transfers/TransferManager.js')).transferManager.getSession(session.transferId);
        assert.equal(failedSession?.status, 'FAILED');
    });
    it('avoids silent file overwrites by generating unique names', async () => {
        const fileName = 'existing.txt';
        const filePath1 = path.join(testDir, fileName);
        await fs.writeFile(filePath1, 'content 1');
        const path2 = await getUniqueDestinationPath(testDir, fileName);
        assert.equal(path.basename(path2), 'existing (1).txt');
        await fs.writeFile(path2, 'content 2');
        const path3 = await getUniqueDestinationPath(testDir, fileName);
        assert.equal(path.basename(path3), 'existing (2).txt');
    });
});
//# sourceMappingURL=transfer.test.js.map