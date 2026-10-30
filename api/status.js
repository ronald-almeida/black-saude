import { API, PRICE, readToken, reply } from '../lib/blackcat.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return reply(res, 405, { error: 'Método não permitido.' }); }
  const key = process.env.BLACKCAT_API_KEY;
  if (!key) return reply(res, 503, { error: 'Consulta indisponível.' });
  let id;
  try { id = readToken(req.headers.authorization?.replace(/^Bearer /, ''), key); }
  catch { return reply(res, 401, { error: 'Consulta inválida ou expirada.' }); }
  try {
    const response = await fetch(`${API}/sales/${encodeURIComponent(id)}/status`, { headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok || !result.success || result.data?.amount !== PRICE) return reply(res, 502, { error: 'Não foi possível consultar o pagamento.' });
    return reply(res, 200, { status: result.data.status });
  } catch { return reply(res, 502, { error: 'Consulta temporariamente indisponível.' }); }
}
