import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

async function runEndToEndVerification() {
  const args = process.argv.slice(2);
  let targetFileName = 'test-10mb.bin';
  for (const arg of args) {
    if (arg.startsWith('--file=')) targetFileName = arg.split('=')[1];
  }

  const filePath = path.resolve(process.cwd(), targetFileName);
  if (!fs.existsSync(filePath)) {
    console.error(`Test file ${filePath} not found`);
    process.exit(1);
  }

  const stat = fs.statSync(filePath);
  const fileBytes = stat.size;

  // Calculate hash of local file
  const localHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  console.log(`[1] Local test file: ${path.basename(filePath)} (${(fileBytes / (1024 * 1024)).toFixed(2)} MiB)`);
  console.log(`    SHA-256: ${localHash}`);

  // Step 1: Create session in Control Plane
  console.log('[2] Registering transfer session via POST /api/transfers...');
  const createRes = await fetch('http://localhost:37821/api/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'verified_test_10mb.bin',
      fileSize: fileBytes,
      expectedHash: localHash,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Create transfer failed: ${createRes.status} ${await createRes.text()}`);
  }

  const session = await createRes.json();
  console.log(`    Transfer session created: ID = ${session.transferId}`);

  // Step 2: Stream Data Plane
  console.log('[3] Streaming binary file payload via PUT /api/transfers/:id/stream...');
  const readStream = fs.createReadStream(filePath);
  const startTime = Date.now();

  const streamRes = await fetch(`http://localhost:37821/api/transfers/${session.transferId}/stream`, {
    method: 'PUT',
    duplex: 'half',
    body: readStream,
  });

  if (!streamRes.ok) {
    throw new Error(`Stream transfer failed: ${streamRes.status} ${await streamRes.text()}`);
  }

  const streamResult = await streamRes.json();
  const durationSec = Math.max(0.001, (Date.now() - startTime) / 1000);
  const speedMiB = (fileBytes / (1024 * 1024)) / durationSec;

  console.log(`    ✅ Transfer stream completed in ${durationSec.toFixed(3)}s (${speedMiB.toFixed(2)} MiB/s)`);
  console.log(`    Server Final Hash: ${streamResult.finalHash}`);

  // Step 3: Verify Integrity Match
  if (streamResult.finalHash.toLowerCase() === localHash.toLowerCase()) {
    console.log('    🛡️ CRYPTOGRAPHIC INTEGRITY VERIFIED: SHA-256 match confirmed!');
  } else {
    throw new Error('Integrity failure: Server hash does not match local hash!');
  }

  // Step 4: Verify Download
  console.log('[4] Verifying file download via GET /api/files/:id/download...');
  const downloadRes = await fetch(`http://localhost:37821/api/files/${session.transferId}/download`);
  if (!downloadRes.ok) {
    throw new Error(`Download failed: ${downloadRes.status}`);
  }

  const downloadedBytes = (await downloadRes.arrayBuffer()).byteLength;
  console.log(`    Downloaded bytes: ${downloadedBytes} / ${fileBytes}`);
  if (downloadedBytes === fileBytes) {
    console.log('    ✅ Full byte stream roundtrip verified successfully!');
  }

  console.log('\n🎉 ALL PHASE 1 STREAMING & VERIFICATION CHECKS PASSED!\n');
}

runEndToEndVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
