import { API, reply } from '../lib/blackcat.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return reply(res, 405, { ready: false }); }
  const key = process.env.BLACKCAT_API_KEY;
  if (!key) return reply(res, 503, { ready: false });
  try {
    const response = await fetch(`${API}/sales/seller`, { headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    return reply(res, response.ok && result.success ? 200 : 503, { ready: !!(response.ok && result.success) });
  } catch { return reply(res, 503, { ready: false }); }
}
