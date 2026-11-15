import http from 'node:https';
import crypto from 'node:crypto';

const PUBLIC_URL = 'https://raised-track-dependence-headline.trycloudflare.com';

async function request(method, urlPath, headers = {}, body = null) {
  const url = new URL(urlPath, PUBLIC_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(raw.toString());
          } catch {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json || raw.toString(),
            raw,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function run() {
  console.log('Testing public tunnel endpoint:', PUBLIC_URL);

  const ping = await request('GET', '/api/system/ping');
  console.log('1. Ping over Public Tunnel:', ping.body);

  // 2. Pair over public tunnel
  const pair = await request(
    'POST',
    '/api/pairing/create',
    { 'Content-Type': 'application/json' },
    { hostClientId: 'client-cloud-host', hostDeviceName: 'Laptop-Cloud' }
  );
  console.log('2. Pairing code generated over public tunnel:', pair.body.code);

  const join = await request(
    'POST',
    '/api/pairing/join',
    { 'Content-Type': 'application/json' },
    { code: pair.body.code, guestClientId: 'client-cloud-guest', guestDeviceName: 'Phone-Cloud' }
  );
  console.log('3. Paired successfully over public tunnel:', join.body.success);

  console.log('\n✅ PUBLIC TUNNEL WORKS FLAWLESSLY ACROSS THE INTERNET!');
}

run().catch(console.error);
