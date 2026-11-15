#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Parse CLI args (e.g. --size=50MB --out=./test-50mb.bin)
const args = process.argv.slice(2);
let sizeStr = '10MB';
let outPath = null;

for (const arg of args) {
  if (arg.startsWith('--size=')) {
    sizeStr = arg.split('=')[1].toUpperCase();
  } else if (arg.startsWith('--out=')) {
    outPath = arg.split('=')[1];
  }
}

function parseSize(str) {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|T)?$/i);
  if (!match) return 10 * 1024 * 1024;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'MB').toUpperCase();
  switch (unit) {
    case 'B': return Math.floor(val);
    case 'KB': return Math.floor(val * 1024);
    case 'MB': return Math.floor(val * 1024 * 1024);
    case 'GB': return Math.floor(val * 1024 * 1024 * 1024);
    default: return Math.floor(val * 1024 * 1024);
  }
}

const targetBytes = parseSize(sizeStr);
const defaultFilename = `sharelan_test_${sizeStr.toLowerCase()}.bin`;
const finalPath = outPath ? path.resolve(outPath) : path.resolve(process.cwd(), defaultFilename);

console.log(`Generating test file: ${finalPath} (${(targetBytes / (1024 * 1024)).toFixed(2)} MiB)...`);

const CHUNK_SIZE = 64 * 1024; // 64 KiB pattern chunk
const pattern = Buffer.alloc(CHUNK_SIZE);
for (let i = 0; i < CHUNK_SIZE; i++) {
  pattern[i] = (i * 31 + 17) % 256;
}

const writeStream = fs.createWriteStream(finalPath);
const hasher = crypto.createHash('sha256');

let bytesWritten = 0;
const startTime = Date.now();

function write() {
  let ok = true;
  while (bytesWritten < targetBytes && ok) {
    const remaining = targetBytes - bytesWritten;
    const toWrite = Math.min(remaining, CHUNK_SIZE);
    const chunk = toWrite === CHUNK_SIZE ? pattern : pattern.subarray(0, toWrite);
    
    hasher.update(chunk);
    bytesWritten += chunk.length;
    ok = writeStream.write(chunk);
  }

  if (bytesWritten < targetBytes) {
    writeStream.once('drain', write);
  } else {
    writeStream.end();
  }
}

writeStream.on('finish', () => {
  const durationSec = Math.max(0.001, (Date.now() - startTime) / 1000);
  const hash = hasher.digest('hex');
  console.log(`✅ Generation completed in ${durationSec.toFixed(2)}s`);
  console.log(` ▸ File:     ${finalPath}`);
  console.log(` ▸ Size:     ${bytesWritten} bytes (${(bytesWritten / (1024 * 1024)).toFixed(2)} MiB)`);
  console.log(` ▸ SHA-256:  ${hash}`);
});

writeStream.on('error', (err) => {
  console.error('Error generating file:', err);
  process.exit(1);
});

write();
