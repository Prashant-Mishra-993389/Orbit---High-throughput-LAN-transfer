import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:37821';
const SENDER_DOWNLOADS_DIR = 'C:\\Users\\pm993\\Downloads\\ShareLAN';

async function runRelayTest() {
  console.log('--- Step 1: Create a 5MB test file on sender disk ---');
  const testFilePath = path.resolve('./test_source_relay.bin');
  const testData = crypto.randomBytes(5 * 1024 * 1024);
  fs.writeFileSync(testFilePath, testData);
  const expectedHash = crypto.createHash('sha256').update(testData).digest('hex');
  console.log(`Test source file created: ${testFilePath} (5 MB, SHA-256: ${expectedHash})`);

  console.log('\n--- Step 2: Sender initiates RELAY Transfer Offer ---');
  const offerRes = await fetch(`${BASE_URL}/api/transfers/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'test_source_relay.bin',
      fileSize: testData.length,
      mimeType: 'application/octet-stream',
      senderClientId: 'test-sender-laptop-a',
      senderDeviceName: 'Laptop-A',
      targetClientId: 'test-receiver-laptop-b',
      transportMode: 'RELAY_STREAM',
    }),
  });

  if (!offerRes.ok) {
    throw new Error(`Offer creation failed: ${offerRes.status} ${await offerRes.text()}`);
  }
  const offer = await offerRes.json();
  const transferId = offer.transferId;
  const relaySessionId = offer.relaySessionId || transferId;
  console.log(`Relay offer created: transferId = ${transferId}, relaySessionId = ${relaySessionId}`);

  console.log('\n--- Step 3: Recipient accepts transfer ---');
  const acceptRes = await fetch(`${BASE_URL}/api/transfers/${transferId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receiverClientId: 'test-receiver-laptop-b',
      receiverDeviceName: 'Laptop-B',
    }),
  });
  if (!acceptRes.ok) throw new Error(`Accept failed: ${acceptRes.status}`);

  console.log('\n--- Step 4: Stream via Relay Buffer (Zero Disk on Relay or Sender) ---');
  let receivedBytes = 0;
  const receiverHasher = crypto.createHash('sha256');

  const receiverPromise = (async () => {
    const res = await fetch(`${BASE_URL}/api/relay/${relaySessionId}/stream`);
    if (!res.ok || !res.body) throw new Error(`Receiver failed to connect: ${res.status}`);
    for await (const chunk of res.body) {
      receivedBytes += chunk.length;
      receiverHasher.update(chunk);
    }
    return receiverHasher.digest('hex');
  })();

  const sourceStream = fs.createReadStream(testFilePath);
  const senderPromise = (async () => {
    const res = await fetch(`${BASE_URL}/api/relay/${relaySessionId}/stream`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': testData.length.toString(),
      },
      body: sourceStream,
      duplex: 'half',
    });
    if (!res.ok) throw new Error(`Sender stream failed: ${res.status}`);
    return res.json();
  })();

  const [receiverHash, senderResult] = await Promise.all([receiverPromise, senderPromise]);
  console.log(`Relay Stream complete!`);
  console.log(`Bytes received by receiver: ${receivedBytes}`);
  console.log(`Sender final hash:   ${senderResult.finalHash}`);
  console.log(`Receiver hash:       ${receiverHash}`);
  console.log(`Expected hash:       ${expectedHash}`);

  if (receiverHash !== expectedHash || senderResult.finalHash !== expectedHash) {
    throw new Error('HASH MISMATCH on Relay!');
  }
  console.log('SUCCESS: Relay Bit-for-bit SHA-256 match!');

  console.log('\n--- Step 5: VERIFY SENDER DISK HAS ZERO COPIES IN DOWNLOADS ---');
  if (fs.existsSync(SENDER_DOWNLOADS_DIR)) {
    const filesInDownloads = fs.readdirSync(SENDER_DOWNLOADS_DIR).filter(f => f !== '.temp');
    if (filesInDownloads.length > 0) {
      throw new Error(`CRITICAL FAILURE: Files written to sender Downloads: ${filesInDownloads.join(', ')}`);
    }
  }
  console.log('SUCCESS: Sender Downloads folder is completely clean!');

  fs.unlinkSync(testFilePath);
  console.log('\nRELAY TEST PASSED COMPLETELY!');
}

runRelayTest().catch((err) => {
  console.error('Relay test error:', err);
  process.exit(1);
});
