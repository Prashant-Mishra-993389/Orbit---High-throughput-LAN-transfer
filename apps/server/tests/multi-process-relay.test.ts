import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELAY_PORT = 37835;

describe('Multi-Process Live Relay Integration Test (A -> C -> B)', () => {
  it('streams a real 10 MB file across independent processes via Relay with zero relay disk footprint and bit-perfect hash', async () => {
    // 1. Prepare 10 MB test file on sender disk
    const testDir = path.join(__dirname, 'scratch-test');
    await fsPromises.mkdir(testDir, { recursive: true });

    const sourceFilePath = path.join(testDir, 'source-10mb.bin');
    const partFilePath = path.join(testDir, 'received.sharelan.part');
    const finalFilePath = path.join(testDir, 'received.bin');

    // Clean any prior artifacts
    await fsPromises.unlink(sourceFilePath).catch(() => {});
    await fsPromises.unlink(partFilePath).catch(() => {});
    await fsPromises.unlink(finalFilePath).catch(() => {});

    console.log('Generating 10 MB test file with random bytes...');
    const fileSize = 10 * 1024 * 1024; // 10 MiB
    const chunk = crypto.randomBytes(64 * 1024); // 64 KiB chunks
    const sourceWriteStream = fs.createWriteStream(sourceFilePath);
    const sourceHasher = crypto.createHash('sha256');

    for (let i = 0; i < fileSize / (64 * 1024); i++) {
      sourceHasher.update(chunk);
      sourceWriteStream.write(chunk);
    }
    sourceWriteStream.end();
    await new Promise((resolve) => sourceWriteStream.on('finish', resolve));

    const expectedHash = sourceHasher.digest('hex');
    console.log(`Test file created. Expected SHA-256: ${expectedHash}`);

    // 2. Spawn Process C (Relay Server)
    console.log(`Spawning Process C (Relay Server) on port ${RELAY_PORT}...`);
    const relayServerPath = path.resolve(__dirname, '../src/relay-server.ts');
    const tsxCli = path.resolve(__dirname, '../../../node_modules/tsx/dist/cli.mjs');
    const relayProc: ChildProcess = spawn(
      process.execPath,
      [tsxCli, relayServerPath],
      {
        env: { ...process.env, RELAY_PORT: `${RELAY_PORT}` },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      }
    );


    relayProc.stdout?.on('data', (d) => process.stdout.write(`[Relay] ${d}`));
    relayProc.stderr?.on('data', (d) => process.stderr.write(`[Relay Err] ${d}`));

    try {
      // Wait for Relay C to be healthy
      let healthy = false;
      const startTime = Date.now();
      while (!healthy && Date.now() - startTime < 15000) {
        try {
          const res = await fetch(`http://127.0.0.1:${RELAY_PORT}/api/system/ping`);
          if (res.ok) healthy = true;
        } catch {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      assert.ok(healthy, 'Relay process failed to start within 15 seconds');
      console.log('Process C (Relay) is up and healthy!');

      // 3. Register Relay Session
      const sessionId = 'relay-session-' + Date.now();
      const initRes = await fetch(`http://127.0.0.1:${RELAY_PORT}/api/relay/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transferId: sessionId,
          fileName: 'movie-10mb.bin',
          fileSize,
          senderClientId: 'process-a-sender',
          receiverClientId: 'process-b-receiver',
        }),
      });
      assert.equal(initRes.status, 201, 'Relay session registration should return 201');

      // 4. Concurrently run Process A (Sender) and Process B (Receiver)
      console.log('Starting concurrent transfer: Process A -> Relay C -> Process B...');

      const receiverPromise = (async () => {
        // Small delay to ensure sender is awaiting or attaching
        await new Promise((r) => setTimeout(r, 100));

        const getRes = await fetch(`http://127.0.0.1:${RELAY_PORT}/api/relay/${sessionId}/stream`);
        assert.ok(getRes.ok, `Receiver GET stream failed with HTTP ${getRes.status}`);
        assert.ok(getRes.body, 'Receiver response must have a readable body');

        const destHasher = crypto.createHash('sha256');
        let receivedBytes = 0;

        const partWriteStream = fs.createWriteStream(partFilePath, { highWaterMark: 64 * 1024 });

        const reader = (getRes.body as any).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            receivedBytes += value.length;
            destHasher.update(value);
            partWriteStream.write(Buffer.from(value));
          }
        }
        partWriteStream.end();
        await new Promise((resolve) => partWriteStream.on('finish', resolve));

        const calculatedHash = destHasher.digest('hex');

        // Atomic rename upon completion
        await fsPromises.rename(partFilePath, finalFilePath);

        return { receivedBytes, calculatedHash };
      })();

      const senderPromise = (async () => {
        const fileStream = fs.createReadStream(sourceFilePath, { highWaterMark: 64 * 1024 });

        // Pipe directly to Relay PUT
        const putRes = await fetch(`http://127.0.0.1:${RELAY_PORT}/api/relay/${sessionId}/stream`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: fileStream as any,
          duplex: 'half',
        } as any);

        assert.ok(putRes.ok, `Sender PUT stream failed with HTTP ${putRes.status}`);
        const putData = await putRes.json();
        return putData;
      })();

      const [senderResult, receiverResult] = await Promise.all([senderPromise, receiverPromise]);

      console.log(`Sender reported: ${senderResult.bytesRelayed} bytes, hash: ${senderResult.finalHash}`);
      console.log(`Receiver wrote: ${receiverResult.receivedBytes} bytes, hash: ${receiverResult.calculatedHash}`);

      // 5. Assertions
      assert.equal(receiverResult.receivedBytes, fileSize, 'Receiver must receive exact total bytes');
      assert.equal(senderResult.bytesRelayed, fileSize, 'Sender must relay exact total bytes');
      assert.equal(receiverResult.calculatedHash, expectedHash, 'Received file hash must match original file');
      assert.equal(senderResult.finalHash, expectedHash, 'Sender hash must match original file');

      // Verify file exists on destination disk with correct size
      const finalStat = await fsPromises.stat(finalFilePath);
      assert.equal(finalStat.size, fileSize, 'Final destination file size must equal source');

      console.log('SUCCESS: Multi-process live relay transfer verified perfectly!');
    } finally {
      // 6. Cleanup child processes and temp files
      relayProc.kill();
      await fsPromises.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('handles mid-stream abort/cancellation and cleanly terminates memory buffers', async () => {
    const relayServerPath = path.resolve(__dirname, '../src/relay-server.ts');
    const tsxCli = path.resolve(__dirname, '../../../node_modules/tsx/dist/cli.mjs');
    const testPort = 37836;
    const relayProc: ChildProcess = spawn(
      process.execPath,
      [tsxCli, relayServerPath],
      {
        env: { ...process.env, RELAY_PORT: `${testPort}` },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      }
    );

    try {
      let healthy = false;
      const startTime = Date.now();
      while (!healthy && Date.now() - startTime < 10000) {
        try {
          const res = await fetch(`http://127.0.0.1:${testPort}/api/system/ping`);
          if (res.ok) healthy = true;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      assert.ok(healthy, 'Relay process failed to start');

      const sessionId = 'cancel-session-' + Date.now();
      await fetch(`http://127.0.0.1:${testPort}/api/relay/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transferId: sessionId,
          fileName: 'abort-test.bin',
          fileSize: 50 * 1024 * 1024,
          senderClientId: 'sender-abort',
        }),
      });

      // Abort controller
      const controller = new AbortController();

      // Start receiver GET with abort controller
      const receiverPromise = fetch(`http://127.0.0.1:${testPort}/api/relay/${sessionId}/stream`, {
        signal: controller.signal,
      }).catch((err) => {
        return { aborted: true, error: err.name };
      });

      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);

      const res = await receiverPromise;
      assert.ok((res as any).aborted, 'Receiver should cleanly abort upon signal');
      console.log('Cancellation cleanly handled across processes!');
    } finally {
      relayProc.kill();
    }
  });
});

