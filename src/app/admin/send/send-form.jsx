// app/admin/send/send-form.jsx
'use client';

import { useState } from 'react';

export default function SendForm({ action }) {
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  async function handleAction(fd) {
    setOk('');
    setErr('');
    setPending(true);
    try {
      await action(fd);                 // ← サーバーアクションを実行
      setOk('送信しました。');
      const ta = document.querySelector('textarea[name="text"]');
      if (ta) ta.value = '';
    } catch (e) {
      setErr(e?.message || '送信に失敗しました。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleAction} style={{ display: 'grid', gap: 12 }}>
      <textarea
        name="text"
        required
        rows={6}
        placeholder="本文を入力"
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 10,
          border: '1px solid #ddd',
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #ddd',
            cursor: pending ? 'not-allowed' : 'pointer',
            background: pending ? '#f3f3f3' : 'white',
          }}
        >
          {pending ? '送信中…' : '一斉送信する'}
        </button>
        {ok && <span style={{ color: '#067d00' }}>{ok}</span>}
        {err && <span style={{ color: '#c40000' }}>{err}</span>}
      </div>
    </form>
  );
}
