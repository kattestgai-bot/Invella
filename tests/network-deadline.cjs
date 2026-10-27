const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/invella-network.js'), 'utf8');
function harness(stall) {
  let signal, completed = false;
  const window = { fetch: async (_, options) => {
    signal = options.signal;
    return { status: 200, statusText: 'OK', headers: new Headers(), arrayBuffer: () => stall ? new Promise((resolve, reject) => {
      if(signal.aborted)reject(new DOMException('aborted','AbortError'));else signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }) : Promise.resolve(new TextEncoder().encode('complete').buffer).then(bytes => { completed = true; return bytes; }) };
  } };
  vm.runInNewContext(source, { window, AbortController, Response, setTimeout: fn => setTimeout(fn, 20), clearTimeout });
  return { window, completed: () => completed, signal: () => signal };
}
(async () => {
  let h = harness(false), response = await h.window.invellaFetch('/sb/auth/v1/user');
  assert.equal(h.completed(), true);
  assert.equal(await response.text(), 'complete');
  h = harness(true);
  await assert.rejects(h.window.invellaFetch('/sb/auth/v1/user'), { name: 'AbortError' });
  assert.equal(h.signal().aborted, true, 'A stalled body must hit the deadline even after HTTP 200 headers');
  h = harness(true);
  const parent = new AbortController(), pending = h.window.invellaFetch('/api/payment-status', { signal: parent.signal });
  await Promise.resolve(); parent.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  console.log('PASS: complete-body deadline, valid response body, upstream cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
