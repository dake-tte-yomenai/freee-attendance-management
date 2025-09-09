import 'server-only';
import fs from 'fs/promises';
import path from 'path';

const TOKENS_PATH = path.join(process.cwd(), 'tokens.json');

export async function readTokens() {
  try {
    const txt = await fs.readFile(TOKENS_PATH, 'utf8');
    return JSON.parse(txt); // { access_token, refresh_token }
  } catch {
    return { access_token: null, refresh_token: null };
  }
}

export async function writeTokens(tokens) {
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}
