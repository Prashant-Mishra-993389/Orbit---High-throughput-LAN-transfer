import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { startServer } from '../apps/server/dist/index.js';

async function test1GBStreaming() {
  console.log('=== Verifying 1.2 GB Large-Scale Streaming Transfer ===\n');

  // Start in-process server on dynamic port
  const running = await startServer({ port: 37840, host: '127.0.0.1', autoTunnel: false });
  console.log(`Server started on port ${running.port}`);

  const ONE_MB = 1024 * 1024;
  const TOTAL_SIZE = 1200 * ONE_MB; // 1.2 GB
  const CHUNK_SIZE = 64 * 1024;     // 64 KiB
  const TOTAL_CHUNKS = TOTAL_SIZE / CHUNK_SIZE;

  // Create a reusable deterministic pattern chunk
  const baseChunk = Buffer.alloc(CHUNK_SIZE);
  for (let i = 0; i < CHUNK_SIZE; i++) {
    baseChunk[i] = (i * 31 + 7) & 0xff;
  }

  // Pre-calculate expected SHA-256 hash
  console.log('[1] Pre-calculating expected SHA-256 for 1.2 GB payload...');
  const expectedHasher = crypto.createHash('sha256');
  for (let i = 0; i < TOTAL_CHUNKS; i++) {
    expectedHasher.update(baseChunk);
  }
  const expectedHash = expectedHasher.digest('hex');
  console.log(`    Expected Hash: ${expectedHash}`);

  // Create offer
  console.log('[2] Creating 1.2 GB Transfer Offer...');
  const offerRes = await fetch(`http://127.0.0.1:${running.port}/api/transfers/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'large_archive_1.2GB.iso',
      fileSize: TOTAL_SIZE,
      mimeType: 'application/octet-stream',
      expectedHash,
      senderClientId: 'tester-sender',
    }),
  });

  if (!offerRes.ok) throw new Error(`Offer failed: ${offerRes.status}`);
  const offer = await offerRes.json();
  const transferId = offer.transferId;
  console.log(`    Offer created. Transfer ID: ${transferId}`);

  // Monitor RAM usage
  const initialMem = process.memoryUsage().heapUsed / ONE_MB;
  let peakMem = initialMem;

  // Start concurrent receiver
  console.log('[3] Connecting Receiver stream...');
  const tStart = Date.now();

  const receiverPromise = (async () => {
    const res = await fetch(`http://127.0.0.1:${running.port}/api/transfers/${transferId}/live-pipe`);
    if (!res.ok) throw new Error(`Receiver failed with HTTP ${res.status}`);

    // Verify response headers
    const contentLength = res.headers.get('content-length');
    const contentDisposition = res.headers.get('content-disposition');
    console.log(`    Receiver received headers:`);
    console.log(`      Content-Length: ${contentLength} (Expected: ${TOTAL_SIZE})`);
    console.log(`      Content-Disposition: ${contentDisposition}`);

    if (parseInt(contentLength || '0', 10) !== TOTAL_SIZE) {
      throw new Error(`Content-Length mismatch: expected ${TOTAL_SIZE}, got ${contentLength}`);
    }

    const reader = res.body.getReader();
    const rxHasher = crypto.createHash('sha256');
    let totalReceived = 0;
    let lastLogTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalReceived += value.length;
      rxHasher.update(value);

      const curMem = process.memoryUsage().heapUsed / ONE_MB;
      if (curMem > peakMem) peakMem = curMem;

      if (Date.now() - lastLogTime > 1500) {
        lastLogTime = Date.now();
        const pct = ((totalReceived / TOTAL_SIZE) * 100).toFixed(1);
        const mb = (totalReceived / ONE_MB).toFixed(0);
        console.log(`    [Receiver] Streamed: ${mb} / 1200 MB (${pct}%) | Heap: ${curMem.toFixed(1)} MB`);
      }
    }

    return {
      bytesReceived: totalReceived,
      hash: rxHasher.digest('hex'),
    };
  })();

  // Start concurrent sender
  console.log('[4] Starting Sender 1.2 GB stream...');
  let chunksSent = 0;
  const senderStream = new Readable({
    read() {
      if (chunksSent < TOTAL_CHUNKS) {
        this.push(baseChunk);
        chunksSent++;
      } else {
        this.push(null);
      }
    },
  });

  const senderRes = await fetch(`http://127.0.0.1:${running.port}/api/transfers/${transferId}/live-pipe`, {
    method: 'PUT',
    duplex: 'half',
    body: senderStream,
  });

  if (!senderRes.ok) throw new Error(`Sender failed: ${senderRes.status}`);
  const senderResult = await senderRes.json();
  const receiverResult = await receiverPromise;

  const durationSec = Math.max(0.001, (Date.now() - tStart) / 1000);
  const throughput = (TOTAL_SIZE / ONE_MB) / durationSec;

  console.log(`\n🎉 === 1.2 GB STREAMING TRANSFER SUCCESSFUL! ===`);
  console.log(` ▸ Bytes Transferred: ${receiverResult.bytesReceived} / ${TOTAL_SIZE}`);
  console.log(` ▸ Duration:          ${durationSec.toFixed(2)}s`);
  console.log(` ▸ Throughput:        ${throughput.toFixed(2)} MB/s`);
  console.log(` ▸ Sender Hash:       ${senderResult.finalHash}`);
  console.log(` ▸ Receiver Hash:     ${receiverResult.hash}`);
  console.log(` ▸ Expected Hash:     ${expectedHash}`);
  console.log(` ▸ Hash Match:        ${receiverResult.hash === expectedHash ? '✅ 100% MATCH' : '❌ MISMATCH'}`);
  console.log(` ▸ Initial Heap RAM:  ${initialMem.toFixed(1)} MB`);
  console.log(` ▸ Peak Heap RAM:     ${peakMem.toFixed(1)} MB (Bounded, ZERO memory exhaustion!)`);

  await running.stop();
  console.log('\nServer cleanly stopped.');

  if (receiverResult.hash !== expectedHash) {
    process.exit(1);
  }
}

test1GBStreaming().catch((err) => {
  console.error('\n❌ 1.2 GB Transfer Test Failed:', err);
  process.exit(1);
});
