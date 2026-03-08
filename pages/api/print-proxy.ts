import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  const base = process.env.PRINT_API_URL;
  const token = process.env.PRINT_API_TOKEN;
  if (!base || !token) return res.status(500).json({ ok:false, error:'Print API not configured' });

  const action = (req.query.action as string) || 'health';
  const url = action === 'health' ? `${base}/api/health`
            : action === 'catalog' ? `${base}/api/catalog`
            : action === 'print' ? `${base}/api/print`
            : action === 'print-topic' ? `${base}/api/print-topic`
            : `${base}/healthz`;

  const timeout = parseInt(process.env.PRINT_PROXY_TIMEOUT_MS || '15000', 10);
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), timeout);

  try {
    const init:any = { method: req.method, headers: { 'X-PRINT-TOKEN': token } , signal: controller.signal };
    if (req.method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body || {});
    }
    const r = await fetch(url, init);
    clearTimeout(t);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await r.json();
      return res.status(r.status).json(j);
    } else {
      const raw = await r.text();
      return res.status(r.status).json({ raw });
    }
  } catch (e:any) {
    clearTimeout(t);
    return res.status(502).json({ ok:false, error: e?.message || 'Bad gateway' });
  }
}
