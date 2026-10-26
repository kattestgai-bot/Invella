const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../connection-check.html'), 'utf8');
assert.ok(Buffer.byteLength(html) < 16384, 'The diagnostic page must remain small enough to load independently');
assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+stylesheet/i, 'The check must not depend on the files it diagnoses');
const context = { document: { readyState: 'loading', getElementById: () => ({}), addEventListener() {} }, AbortController, Date, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
(async () => {
  context.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(42) });
  let r = await context.checkResource('/test', 'fixture', 100);
  assert.equal(r.status, 'ok'); assert.equal(r.bytes, 42);
  context.fetch = async () => ({ ok: false, status: 404 });
  r = await context.checkResource('/test', 'fixture', 100);
  assert.equal(r.status, 'http'); assert.equal(r.code, 404);
  context.fetch = async (url, options) => {
    let first = true;
    return { ok: true, status: 200, body: { getReader: () => ({ read: () => {
      if (first) { first = false; return Promise.resolve({ done: false, value: new Uint8Array(16384) }); }
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    } }) } };
  };
  r = await context.checkResource('/test', 'fixture', 10);
  assert.equal(r.status, 'timeout'); assert.equal(r.bytes, 16384, 'A stalled partial download must retain its byte count');
  context.fetch = async () => { throw new TypeError('Failed to fetch'); };
  r = await context.checkResource('/test', 'fixture', 100);
  assert.equal(r.status, 'network'); assert.equal(r.bytes, 0);
  console.log('PASS: standalone diagnostic, successful response, HTTP error, stalled partial transfer, network failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
