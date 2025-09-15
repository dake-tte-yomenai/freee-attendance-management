export const runtime = 'nodejs';

import { lineBroadcast } from '../../../../lib/line.js';

export async function POST(req) {
  const { text } = await req.json();
  await lineBroadcast([{ type: 'text', text }]);
  return new Response('ok', { status: 200 });
}
