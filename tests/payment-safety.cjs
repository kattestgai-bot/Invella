const assert = require('node:assert/strict');
const status = require('../api/payment-status');
const hook = require('../api/yookassa-webhook');
process.env.YOOKASSA_SHOP_ID = 'live';
process.env.YOOKASSA_SECRET_KEY = 'live-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
function response(data, ok = true, code = 200) { return { ok, status: code, json: async () => data, text: async () => JSON.stringify(data) }; }
function res() { return { code: 0, setHeader() {}, status(n) { this.code = n; return this; }, json(d) { this.data = d; return this; } }; }
const payment = { id: 'test-id', test: true, status: 'succeeded', paid: true, amount: { currency: 'RUB', value: '990.00' }, metadata: { ownerId: 'qa-user', invitationId: 'qa-invitation', plan: 'basic', qa_run: 'run' } };
(async () => {
  let mutations = 0;
  global.fetch = async (url, opts = {}) => {
    if (opts.method === 'POST' || opts.method === 'PATCH') mutations++;
    if (url.includes('/auth/v1/user')) return response({ id: 'qa-user' });
    if (url.includes('api.yookassa.ru')) return response(payment);
    if (url.includes('/invitations?')) return response([{ id: 'qa-invitation', owner_id: 'qa-user', slug: 'qa-payment-run', status: 'draft' }]);
    if (url.includes('/payments?')) return response([{ id: 'db-test' }]);
    if (url.includes('/rpc/confirm_invella_payment')) return response({published:true,paid:true,plan:'basic'});
    throw Error('Unexpected external call');
  };
  let r = res(); await status({ method: 'POST', headers: { authorization: 'Bearer qa-token' }, body: { paymentId: 'test-id' } }, r);
  assert.equal(r.code, 400); assert.equal(mutations, 0, 'Test payment must never activate through live endpoint');
  r = res(); await hook({ method: 'POST', body: { type: 'payment.succeeded', object: { id: 'test-id' } } }, r);
  assert.equal(r.code, 400); assert.equal(mutations, 0);
  r = res(); await status.withConfig({ shopId: 'test', secretKey: 'test-key', testMode: true, qaRun: 'run' })({ method: 'POST', headers: { authorization: 'Bearer qa-token' }, body: { paymentId: 'test-id' } }, r);
  assert.equal(r.code, 200); assert.equal(r.data.published, true); assert.equal(mutations, 1);
  mutations = 0; payment.metadata.ownerId = 'someone-else';
  r = res(); await status.withConfig({ shopId: 'test', secretKey: 'test-key', testMode: true, qaRun: 'run' })({ method: 'POST', headers: { authorization: 'Bearer qa-token' }, body: { paymentId: 'test-id' } }, r);
  assert.equal(r.code, 403); assert.equal(mutations, 0, 'Other owners must remain untouched');
  payment.metadata.ownerId = 'qa-user'; payment.metadata.qa_run = 'other-run';
  r = res(); await hook.withConfig({ shopId: 'test', secretKey: 'test-key', testMode: true, qaRun: 'run' })({ method: 'POST', body: { type: 'payment.succeeded', object: { id: 'test-id' } } }, r);
  assert.equal(r.code, 400); assert.equal(mutations, 0);
  console.log('PASS: live/test separation, fallback publication, owner isolation, QA run isolation');
})().catch(e => { console.error(e); process.exitCode = 1; });
