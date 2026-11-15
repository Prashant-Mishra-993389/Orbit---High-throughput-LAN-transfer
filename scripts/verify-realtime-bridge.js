import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

async function testRealtimeBridge() {
  console.log('=== Verifying Real-Time Simultaneous Live Streaming ===\n');

  // Generate a test 20MB file
  const testSize = 20 * 1024 * 1024;
  const chunk = Buffer.alloc(64 * 1024);
  for (let i = 0; i < chunk.length; i++) chunk[i] = (i * 17 + 5) % 256;

  const hasher = crypto.createHash('sha256');
  for (let i = 0; i < testSize / chunk.length; i++) hasher.update(chunk);
  const expectedHash = hasher.digest('hex');

  console.log(`[1] Test Payload: 20.00 MiB`);
  console.log(`    Expected SHA-256: ${expectedHash}`);

  // Step 1: Create Live Share Offer
  console.log('[2] Sender creates live offer via POST /api/transfers/offer...');
  const offerRes = await fetch('http://localhost:37821/api/transfers/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'live_stream_demo.iso',
      fileSize: testSize,
      mimeType: 'application/x-iso9660-image',
      expectedHash,
    }),
  });

  if (!offerRes.ok) {
    throw new Error(`Failed to create offer: ${offerRes.status}`);
  }

  const offer = await offerRes.json();
  console.log(`    Live bridge created: Transfer ID = ${offer.transferId}`);

  // Step 2: Recipient connects to live stream concurrently
  console.log('[3] Recipient opens live stream GET /api/transfers/:id/live-pipe...');
  const t0 = Date.now();

  const receiverPromise = (async () => {
    const res = await fetch(`http://localhost:37821/api/transfers/${offer.transferId}/live-pipe`);
    if (!res.ok) throw new Error(`Receiver failed: ${res.status}`);

    const reader = res.body.getReader();
    const receiverHasher = crypto.createHash('sha256');
    let totalReceived = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalReceived += value.length;
      receiverHasher.update(value);
    }

    return {
      totalReceived,
      finalHash: receiverHasher.digest('hex'),
    };
  })();

  // Step 3: Sender streams chunks simultaneously into the bridge
  console.log('[4] Sender starts streaming chunks into PUT /api/transfers/:id/live-pipe...');
  const senderStream = new (await import('node:stream')).Readable({
    read() {
      if (this.sentBytes === undefined) this.sentBytes = 0;
      if (this.sentBytes < testSize) {
        this.push(chunk);
        this.sentBytes += chunk.length;
      } else {
        this.push(null);
      }
    },
  });

  const senderRes = await fetch(`http://localhost:37821/api/transfers/${offer.transferId}/live-pipe`, {
    method: 'PUT',
    duplex: 'half',
    body: senderStream,
  });

  if (!senderRes.ok) {
    throw new Error(`Sender upload failed: ${senderRes.status}`);
  }

  // Await both sender and receiver
  const [senderData, receiverData] = await Promise.all([
    senderRes.json(),
    receiverPromise,
  ]);

  const durationSec = Math.max(0.001, (Date.now() - t0) / 1000);
  const throughputMiB = (testSize / (1024 * 1024)) / durationSec;

  console.log(`\n✅ Simultaneous Real-Time Transfer Complete!`);
  console.log(` ▸ Duration:          ${durationSec.toFixed(3)}s`);
  console.log(` ▸ Live Throughput:   ${throughputMiB.toFixed(2)} MiB/s`);
  console.log(` ▸ Bytes Transferred: ${receiverData.totalReceived} / ${testSize}`);
  console.log(` ▸ Sender SHA-256:    ${senderData.finalHash}`);
  console.log(` ▸ Receiver SHA-256:  ${receiverData.finalHash}`);

  if (receiverData.finalHash === expectedHash && senderData.finalHash === expectedHash) {
    console.log(` ▸ Integrity Status:  🛡️ 100% CRYPTOGRAPHIC MATCH`);
  } else {
    throw new Error('Integrity hash mismatch!');
  }

  // Verify Sender Disk Footprint
  const downloadsDir = path.resolve(process.env.USERPROFILE || '', 'Downloads', 'ShareLAN');
  const demoFileInDownloads = path.join(downloadsDir, 'live_stream_demo.iso');
  const fileExistsOnSender = fs.existsSync(demoFileInDownloads);

  console.log(`\n🔍 Sender Disk Footprint Verification:`);
  console.log(` ▸ Did Sender duplicate file to its own Downloads folder? ${fileExistsOnSender ? 'YES (FAIL)' : 'NO (ZERO COPIES - SUCCESS!)'}`);

  if (!fileExistsOnSender) {
    console.log(`\n🎉 PROVEN: ZERO duplicate files created on sender! Pure real-time stream pipe verified.\n`);
  } else {
    throw new Error('Sender created an unwanted duplicate file!');
  }
}

testRealtimeBridge().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
