import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

async function lookupParentEmail(name: string): Promise<string | undefined> {
  const contacts = process.env.NEXT_PUBLIC_CONTACTS_CSV_URL;
  if (!contacts) return undefined;
  const res = await fetch(contacts);
  if (!res.ok) return undefined;
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = (lines.shift() || '').split(',');
  const idx = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
  const lc = name.toLowerCase();

  for (const line of lines) {
    const cols = line.split(',');
    const first = (cols[idx['firstname']] || '').trim();
    const last = (cols[idx['lastname']] || '').trim();
    const nameCol = (cols[idx['name']] || '').trim();
    const parentEmail = (cols[idx['parentemail']] || cols[idx['email']] || '').trim();
    const full = (first + ' ' + last).trim() || nameCol;
    if (!full) continue;
    const fullLc = full.toLowerCase();
    if (fullLc === lc) return parentEmail || undefined;

    // Support cases where the UI passes only a first name.
    // (If there are duplicates, the first match is returned.)
    const firstOnlyLc = (first || '').toLowerCase();
    if (firstOnlyLc && firstOnlyLc === lc) return parentEmail || undefined;
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { toName, subject, text, meta } = req.body || {};
  if (!toName || !subject || !text) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }

  const toEmail = await lookupParentEmail(toName);
  if (!toEmail) {
    return res.status(400).json({ ok: false, error: 'Parent email not found for selected student' });
  }

  const user = process.env.MAIL_USER || '';
  const pass = process.env.MAIL_PASS || '';
  const replyTo = process.env.REPLY_TO || user;
  const campusName = process.env.NEXT_PUBLIC_CAMPUS_NAME || 'Success Tutoring Parramatta';

  if (!user || !pass) {
    return res.status(500).json({ ok: false, error: 'MAIL_USER/PASS not configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    const from = `${campusName} <${user}>`;

    const info = await transporter.sendMail({
      from,
      to: toEmail,
      replyTo,
      subject,
      text,
    });

    const webhook = process.env.FEEDBACK_LOG_WEBHOOK_URL;
    if (webhook) {
      const payload = {
        campusKey: meta?.campusKey || 'parramatta',
        campusName: meta?.campusName || campusName,
        tutorName: meta?.tutorName || '',
        studentFirstName: meta?.studentFirstName || (toName.split(' ')[0] || ''),
        parentEmail: toEmail,
        year: meta?.year || '',
        subject: meta?.subject || '',
        strand: meta?.strand || '',
        lesson: meta?.lesson || '',
        topic: meta?.topic || '',
        subjectLine: meta?.subjectLine || subject,
        messageId: info?.messageId || '',
      };

      // Log feedback synchronously so the Google Sheet updates
      // immediately after a successful send.
      try {
        const logRes = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!logRes.ok) {
          // Don't fail the request if logging fails, but surface it in logs.
          console.error('Feedback logging failed', await logRes.text());
        }
      } catch (err) {
        console.error('Feedback logging error', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'send failed' });
  }
}
