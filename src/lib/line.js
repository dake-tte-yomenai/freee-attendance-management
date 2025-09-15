const LINE_API = 'https://api.line.me/v2/bot/message';

async function lineRequest(path, body) {
  const res = await fetch(`${LINE_API}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
    // Next.js Route Handlers は node-fetch 準拠
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LINE API error ${res.status}: ${t}`);
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function lineBroadcast(messages) {
  return lineRequest('broadcast', { messages });
}

export function linePush(to, messages) {
  return lineRequest('push', { to, messages });
}
