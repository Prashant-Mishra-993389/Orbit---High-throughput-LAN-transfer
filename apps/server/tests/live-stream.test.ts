import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable, PassThrough } from 'node:stream';
import { StreamBridgeManager } from '../src/transfers/StreamBridge.js';

describe('Real-Time Live Streaming Bridge (Zero Disk Storage)', () => {
  it('streams chunks simultaneously from sender to receiver in real time with hash verification', async () => {
    const bridgeManager = new StreamBridgeManager();
    const transferId = 'live-test-' + Date.now();

    // Create 5 MB test payload
    const testPayload = Buffer.alloc(5 * 1024 * 1024);
    for (let i = 0; i < testPayload.length; i++) {
      testPayload[i] = (i * 13 + 7) % 256;
    }
    const expectedHash = crypto.createHash('sha256').update(testPayload).digest('hex');

    bridgeManager.createBridge({
      transferId,
      fileName: 'realtime_video.mp4',
      fileSize: testPayload.length,
    });

    // Mock receiver reply stream
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

    // Receiver connects to bridge
    const receiverPromise = bridgeManager.handleReceiverStream(transferId, mockReply as any);

    // Sender streams payload
    const senderStream = Readable.from([testPayload]);
    const senderResultPromise = bridgeManager.handleSenderStream(transferId, senderStream);

    // Wait for both sender and receiver to complete simultaneously
    const [senderResult] = await Promise.all([
      senderResultPromise,
      receiverPromise,
      new Promise<void>((resolve) => receiverSink.on('end', resolve)),
    ]);

    assert.equal(senderResult.bytesTransferred, testPayload.length);
    assert.equal(senderResult.finalHash, expectedHash);

    // Verify receiver received every single byte
    const receivedBuffer = Buffer.concat(receiverChunks);
    assert.equal(receivedBuffer.length, testPayload.length);

    const calculatedReceiverHash = receiverHasher.digest('hex');
    assert.equal(calculatedReceiverHash, expectedHash);
  });
});
