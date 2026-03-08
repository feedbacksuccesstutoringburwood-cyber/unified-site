import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

export default function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const cookie = serialize('st_auth', '', { path:'/', httpOnly:true, sameSite:'lax', secure:true, maxAge: 0 });
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok:true });
}
