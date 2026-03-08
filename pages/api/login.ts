import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

export default function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { campus, tutor, password } = req.body || {};
  const expected = process.env.TUTOR_PASSWORD || '';
  if (!tutor || !password) return res.status(400).json({ ok:false, error:'Missing tutor or password' });
  if (expected && password !== expected) {
    return res.status(401).json({ ok:false, error:'Incorrect password' });
  }

  const isHttps = (req.headers['x-forwarded-proto'] === 'https');
  const cookie = serialize('st_auth', '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production',
    maxAge: 60*60*24*30
  });
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok:true });
}
