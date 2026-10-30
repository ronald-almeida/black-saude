import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, validDocument, formatDocument } from '../public/validation.js';
import pix from '../api/pix.js';
import status from '../api/status.js';
import { readToken, signToken } from '../lib/blackcat.js';
const customer = { name: 'Pessoa Teste', email: 'teste@example.com', phone: '(11) 99999-9999', document: '529.982.247-25', terms: true };
const request = (body = customer) => ({ method: 'POST', headers: { host: 'checkout.test', origin: 'https://checkout.test', 'content-type': 'application/json' }, body });
function response() { return { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
test('CPF and CNPJ check digits, repeated digits and masks', () => {
  assert.equal(validDocument('52998224725'), true);
  assert.equal(validDocument('11222333000181'), true);
  for (const doc of ['11111111111','12345678901','00000000000000','52998224724','11222333000180']) assert.equal(validDocument(doc), false);
  assert.equal(formatDocument('52998224725'), '529.982.247-25');
  assert.equal(formatDocument('11222333000181'), '11.222.333/0001-81');
});
test('all fields and explicit consent required', () => {
  assert.deepEqual(validate(customer), {});
  assert.equal(Object.keys(validate({})).length, 5);
  assert.ok(validate({ ...customer, name:'Pessoa', email:'email@', phone:'1234', terms:false }).name);
  assert.ok(validate({ ...customer, terms:'true' }).terms);
});
test('stateless status tokens reject tampering', () => {
  const token = signToken('TXN-test', 'test-only-secret');
  assert.equal(readToken(token, 'test-only-secret'), 'TXN-test');
  assert.throws(() => readToken(token, 'other-secret'));
  assert.throws(() => readToken('invalid', 'test-only-secret'));
});
test('payment boundary fixes price, excludes untrusted fields and protects secret', async t => {
  process.env.BLACKCAT_API_KEY = 'test-only-secret';
  t.after(() => delete process.env.BLACKCAT_API_KEY);
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.blackcatoficial.com/api/sales/create-sale');
    sent = JSON.parse(options.body);
    assert.equal(options.headers['X-API-Key'], 'test-only-secret');
    return new Response(JSON.stringify({ success:true, data:{ transactionId:'TXN-test', amount:34700, paymentData:{ copyPaste:'000201TEST', qrCodeBase64:'data:image/png;base64,AAAA', expiresAt:'2099-01-01T00:00:00Z' } } }), {status:201});
  });
  const res = response();
  await pix(request({ ...customer, amount:1, items:[], postbackUrl:'https://example.com/steal' }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(sent.amount, 34700);
  assert.equal(sent.items[0].unitPrice, 34700);
  assert.equal(sent.customer.document.type, 'cpf');
  assert.equal(sent.postbackUrl, undefined);
  assert.equal(res.body.code, '000201TEST');
  assert.equal(JSON.stringify(res.body).includes('test-only-secret'), false);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('invalid customer, foreign origin and wrong methods never call gateway', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('must not call'); });
  let res = response(); await pix(request({...customer, document:'11111111111'}), res); assert.equal(res.statusCode,400);
  res = response(); const req = request(); req.headers.origin='https://other.test'; await pix(req,res); assert.equal(res.statusCode,403);
  res = response(); await pix({...request(),method:'GET'},res); assert.equal(res.statusCode,405);
});
test('missing key and gateway failures return safe errors', async t => {
  delete process.env.BLACKCAT_API_KEY;
  let res=response(); await pix(request(),res); assert.equal(res.statusCode,503);
  process.env.BLACKCAT_API_KEY='test-only-secret'; t.after(()=>delete process.env.BLACKCAT_API_KEY);
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({success:false,message:'secret provider details'}),{status:401}));
  res=response(); await pix(request(),res); assert.equal(res.statusCode,502); assert.equal(JSON.stringify(res.body).includes('secret provider'),false);
});
test('status queries only a signed transaction and checks the amount', async t => {
  process.env.BLACKCAT_API_KEY='test-only-secret'; t.after(()=>delete process.env.BLACKCAT_API_KEY);
  t.mock.method(globalThis,'fetch',async url=>{ assert.ok(url.endsWith('/TXN-test/status')); return new Response(JSON.stringify({success:true,data:{status:'PAID',amount:34700}})); });
  const res=response(); await status({method:'GET',headers:{authorization:`Bearer ${signToken('TXN-test','test-only-secret')}`}},res);
  assert.equal(res.body.status,'PAID');
  const bad=response(); await status({method:'GET',headers:{authorization:'Bearer forged'}},bad); assert.equal(bad.statusCode,401);
});
