import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhook = process.env.PRINT_LOG_WEBHOOK_URL;
  if (!webhook) {
    return res.status(500).json({ ok: false, error: 'PRINT_LOG_WEBHOOK_URL not configured' });
  }

  try {
    const body = req.body || {};
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'log failed' });
  }
}
