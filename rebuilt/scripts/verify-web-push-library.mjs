// Offline compatibility check only: no network, subscription persistence or output of keys.
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { generateVAPIDKeys, generateRequestDetails } from 'web-push';

const vapid = generateVAPIDKeys();
assert.equal(Buffer.from(vapid.publicKey, 'base64url').length, 65);
assert.equal(Buffer.from(vapid.privateKey, 'base64url').length, 32);
const client = createECDH('prime256v1');
client.generateKeys();
const payload = JSON.stringify({ v: 1, title: 'SiM-Murid', body: 'Ada pemberitahuan baru.' });
const request = generateRequestDetails({
  endpoint: 'https://push.example.invalid/synthetic',
  keys: {
    p256dh: client.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  },
}, payload, {
  vapidDetails: { subject: 'mailto:operator@example.invalid', ...vapid },
  TTL: 3600,
  contentEncoding: 'aes128gcm',
  timeout: 10000,
});
assert.equal(request.method, 'POST');
assert.equal(request.headers['Content-Encoding'], 'aes128gcm');
assert.equal(request.headers.TTL, 3600);
assert.ok(request.headers.Authorization ?? request.headers.authorization);
assert.ok(request.body.length > 0);
assert.equal(request.body.includes(Buffer.from(payload)), false);
console.log('Web Push offline compatibility passed: VAPID, encrypted request and headers; no network.');
