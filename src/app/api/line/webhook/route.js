export const runtime = 'nodejs';

import crypto from 'node:crypto';

function verifyLineSignature(body, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hmac === signature;
}

export async function POST(req) {
  const signature = req.headers.get('x-line-signature');
  const rawBody = await req.text();

  if (!verifyLineSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const { events } = JSON.parse(rawBody);

  for (const ev of events || []) {
    if (ev.type === 'follow') {
      const userId = ev?.source?.userId; // ← 個別配信したい場合はDBへ保存
      console.log('followed by', userId);
    }
  }
  return new Response('OK', { status: 200 });
}
