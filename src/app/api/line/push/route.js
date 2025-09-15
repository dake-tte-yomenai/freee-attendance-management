export const runtime = 'nodejs';

import { linePush } from '../../../../lib/line.js';

export async function POST(req) {
  const { to, text } = await req.json();
  await linePush(to, [{ type: 'text', text }]);
  return new Response('ok', { status: 200 });
}
