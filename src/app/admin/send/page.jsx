// app/admin/send/page.jsx
import SendForm from './send-form';
import { lineBroadcast } from '../../../../src/lib/line.js'; // ←プロジェクトの実パスに合わせて調整

export const dynamic = 'force-dynamic';

// Server Action: 送信処理
export async function sendBroadcast(formData) {
  'use server';
  const text = (formData.get('text') || '').toString().trim();
  if (!text) {
    throw new Error('メッセージを入力してください');
  }
  // 必要なら文字数制限などをここでチェック
  await lineBroadcast([{ type: 'text', text }]);
}

export default function Page() {
  return (
    <main style={{ maxWidth: 680, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        一斉送信（Broadcast）
      </h1>
      <p style={{ color: '#555', marginBottom: 16 }}>
        下のテキストを送信すると、友だち全員に配信されます。
      </p>
      <SendForm action={sendBroadcast} />
    </main>
  );
}
