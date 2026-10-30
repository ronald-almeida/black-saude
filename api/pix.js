import { randomUUID } from 'node:crypto';
import { validate, digits } from '../public/validation.js';
import { API, PRICE, TITLE, reply, signToken } from '../lib/blackcat.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(res, 405, { error: 'Método não permitido.' }); }
  if (!req.headers.origin || req.headers.origin !== `https://${req.headers.host}` && req.headers.origin !== `http://${req.headers.host}`) return reply(res, 403, { error: 'Origem não permitida.' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) return reply(res, 415, { error: 'Envie os dados em JSON.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return reply(res, 400, { error: 'Dados inválidos.' }); }
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > 4096) return reply(res, 400, { error: 'Dados inválidos.' });
  const errors = validate(body);
  if (Object.keys(errors).length) return reply(res, 400, { error: 'Confira os dados informados.', fields: errors });
  const key = process.env.BLACKCAT_API_KEY;
  if (!key) return reply(res, 503, { error: 'Pagamento temporariamente indisponível. Tente novamente mais tarde.' });
  const document = digits(body.document);
  const payload = {
    amount: PRICE, currency: 'BRL', paymentMethod: 'pix',
    items: [{ title: TITLE, unitPrice: PRICE, quantity: 1, tangible: false }],
    customer: { name: body.name.trim(), email: body.email.trim(), phone: digits(body.phone), document: { number: document, type: document.length === 11 ? 'cpf' : 'cnpj' } },
    pix: { expiresInDays: 1 }, externalRef: `black-saude-${randomUUID()}`
  };
  try {
    const upstream = await fetch(`${API}/sales/create-sale`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(45000) });
    const result = await upstream.json();
    if (!upstream.ok || result.success !== true) return reply(res, 502, { error: 'Não foi possível gerar o Pix. Confira seus dados e tente novamente em instantes.' });
    const sale = result.data;
    const pix = sale?.paymentData;
    const code = pix?.copyPaste || pix?.qrCode;
    if (!sale?.transactionId || sale.amount !== PRICE || typeof code !== 'string' || !code.startsWith('000201')) return reply(res, 502, { error: 'A operadora retornou um Pix inválido. Tente novamente mais tarde.' });
    let qrImage = typeof pix.qrCodeBase64 === 'string' ? pix.qrCodeBase64 : '';
    if (qrImage && !qrImage.startsWith('data:')) qrImage = `data:image/png;base64,${qrImage}`;
    if (!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(qrImage)) qrImage = '';
    return reply(res, 201, { code, qrImage, expiresAt: pix.expiresAt || null, token: signToken(sale.transactionId, key), amount: PRICE });
  } catch {
    return reply(res, 502, { error: 'Não recebemos a confirmação da operadora. Aguarde alguns instantes antes de tentar novamente.' });
  }
}
