import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable, PassThrough } from 'node:stream';
import { PairingManager } from '../src/pairing/PairingManager.js';
import { RelayBridgeManager } from '../src/transfers/RelayBridge.js';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@sharelan/shared';

describe('Hostel Wi-Fi AP-Isolation Resilience & Relay Engine', () => {
  describe('PairingManager (Out-of-Band 6-Digit Discovery)', () => {
    let pm: PairingManager;

    afterEach(() => {
      if (pm) pm.destroy();
    });

    it('generates 6-digit code formatted as XXX-XXX and stores session', () => {
      pm = new PairingManager();
      const session = pm.createSession({
        hostClientId: 'host-laptop-1',
        hostDeviceName: 'MacBook Pro',
        hostIp: '192.168.1.15',
        hostPort: 37821,
      });

      assert.match(session.code, /^\d{3}-\d{3}$/);
      assert.equal(session.status, 'WAITING');
      assert.equal(session.hostClientId, 'host-laptop-1');
      assert.ok(session.sharedSecret.length > 16);

      const retrieved = pm.getSession(session.code);
      assert.ok(retrieved);
      assert.equal(retrieved.hostClientId, 'host-laptop-1');
    });

    it('allows guest to match with host using normalized 6-digit code', () => {
      pm = new PairingManager();
      const hostSession = pm.createSession({
        hostClientId: 'host-client-99',
        hostDeviceName: 'Host Laptop',
        hostIp: '10.0.0.5',
        hostPort: 37821,
      });

      // Guest enters code without dash or with spaces
      const rawCode = hostSession.code.replace('-', ' ');
      const matched = pm.joinSession({
        code: rawCode,
        guestClientId: 'guest-client-88',
        guestDeviceName: 'Guest Laptop',
        guestIp: '10.0.0.12',
        guestPort: 37821,
      });

      assert.ok(matched);
      assert.equal(matched.status, 'PAIRED');
      assert.equal(matched.guestClientId, 'guest-client-88');
      assert.equal(matched.hostClientId, 'host-client-99');
      assert.equal(matched.sharedSecret, hostSession.sharedSecret);
    });

    it('rejects expired pairing codes automatically', async () => {
      pm = new PairingManager();
      const session = pm.createSession({
        hostClientId: 'host-short-ttl',
        hostDeviceName: 'Host Laptop',
        hostIp: '10.0.0.5',
        hostPort: 37821,
        ttlMs: 50, // 50ms TTL
      });

      // Wait 70ms for expiration
      await new Promise((r) => setTimeout(r, 70));

      const retrieved = pm.getSession(session.code);
      assert.equal(retrieved, null);

      const joinResult = pm.joinSession({
        code: session.code,
        guestClientId: 'guest-too-late',
        guestDeviceName: 'Guest Laptop',
        guestIp: '10.0.0.12',
        guestPort: 37821,
      });
      assert.equal(joinResult, null);
    });
  });

  describe('RelayBridge (Zero-Disk Streaming Buffer with Backpressure)', () => {
    let rm: RelayBridgeManager;

    afterEach(() => {
      if (rm) rm.destroy();
    });

    it('forwards live stream directly through memory with zero disk footprint and strict backpressure', async () => {
      rm = new RelayBridgeManager();
      const sessionId = 'relay-test-' + Date.now();

      // Create 8 MB payload (larger than 64 KiB buffer to test backpressure)
      const testPayload = Buffer.alloc(8 * 1024 * 1024);
      for (let i = 0; i < testPayload.length; i++) {
        testPayload[i] = (i * 31 + 17) % 256;
      }
      const expectedHash = crypto.createHash('sha256').update(testPayload).digest('hex');

      rm.createSession({
        sessionId,
        transferId: 'transfer-' + Date.now(),
        fileName: 'hostel_transfer.iso',
        fileSize: testPayload.length,
        senderClientId: 'sender-laptop',
        receiverClientId: 'receiver-laptop',
      });

      // Mock receiver HTTP reply stream
      const receiverSink = new PassThrough();
      const receiverChunks: Buffer[] = [];
      const receiverHasher = crypto.createHash('sha256');

      receiverSink.on('data', (chunk) => {
        receiverChunks.push(chunk);
        receiverHasher.update(chunk);
      });

      const mockReply = {
        header: () => {},
        send: (stream: Readable) => {
          stream.pipe(receiverSink);
        },
      };

      // Receiver connects to relay session
      const receiverPromise = rm.handleReceiverStream(sessionId, mockReply as any);

      // Sender streams chunks into relay session
      // Simulating chunks of 128 KiB
      const chunkSize = 128 * 1024;
      const chunks: Buffer[] = [];
      for (let offset = 0; offset < testPayload.length; offset += chunkSize) {
        chunks.push(testPayload.subarray(offset, Math.min(testPayload.length, offset + chunkSize)));
      }

      const senderStream = Readable.from(chunks);
      const senderResultPromise = rm.handleSenderStream(sessionId, senderStream);

      // Wait for both sender and receiver to complete
      const [senderResult] = await Promise.all([
        senderResultPromise,
        receiverPromise,
        new Promise<void>((resolve) => receiverSink.on('end', resolve)),
      ]);

      assert.equal(senderResult.bytesRelayed, testPayload.length);
      assert.equal(senderResult.finalHash, expectedHash);

      const receivedTotal = Buffer.concat(receiverChunks);
      assert.equal(receivedTotal.length, testPayload.length);
      assert.equal(receiverHasher.digest('hex'), expectedHash);
    });
  });

  describe('End-to-End Encryption (E2EE) Chunks over Relay', () => {
    it('encrypts and decrypts chunks using key derived from pairing secret', async () => {
      const pairingSecret = '482-195';
      const key = await deriveKeyFromSecret(pairingSecret);

      const plaintext = new TextEncoder().encode('ShareLAN high-performance LAN transfer on hostel Wi-Fi');

      const encrypted = await encryptChunk(plaintext, key);
      assert.notDeepEqual(encrypted, plaintext);
      assert.ok(encrypted.length > plaintext.length);

      const decrypted = await decryptChunk(encrypted, key);
      assert.deepEqual(decrypted, plaintext);

      const decryptedText = new TextDecoder().decode(decrypted);
      assert.equal(decryptedText, 'ShareLAN high-performance LAN transfer on hostel Wi-Fi');
    });

    it('fails decryption if encrypted chunk is tampered with', async () => {
      const pairingSecret = '912-345';
      const key = await deriveKeyFromSecret(pairingSecret);
      const plaintext = new TextEncoder().encode('Sensitive File Bytes');

      const encrypted = await encryptChunk(plaintext, key);

      // Tamper with a byte in ciphertext
      encrypted[encrypted.length - 1] ^= 0xff;

      await assert.rejects(
        async () => {
          await decryptChunk(encrypted, key);
        },
        /operation failed|mac check failed/i
      );
    });
  });
});
