// app/liff/bind/page.jsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

// 期限切れ時だけ再ログイン（無限ループ防止の1回リトライ）
async function getFreshIdToken(setMsg) {
  const liff = (await import("@line/liff")).default;
  const idToken = liff.getIDToken?.();

  if (!idToken) {
    if (!sessionStorage.getItem("liffRetry")) {
      sessionStorage.setItem("liffRetry", "1");
      setMsg("LINEセッションを再取得します…");
      liff.login({ redirectUri: location.href.split("#")[0] });
    } else {
      setMsg("LINEの認証に失敗しました。LINEアプリから開き直してください。");
    }
    return null;
  }

  // 取れれば exp をチェック（取れなくてもそのまま使う）
  try {
    const [, payload] = idToken.split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const now = Math.floor(Date.now() / 1000);
    if (json?.exp && json.exp - now < 10) {
      if (!sessionStorage.getItem("liffRetry")) {
        sessionStorage.setItem("liffRetry", "1");
        setMsg("LINEセッションを更新します…");
        liff.login({ redirectUri: location.href });
      } else {
        setMsg("LINEの認証に失敗しました。LINEアプリから開き直してください。");
      }
      return null;
    }
  } catch {
    // デコード失敗は無視して続行
  }
  sessionStorage.removeItem("liffRetry");
  return idToken;
}

export default function Page() {
  return (
    <Suspense fallback={<p>初期化中…</p>}>
      <BindInner />
    </Suspense>
  );
}

function BindInner() {
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("初期化中…");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({
          liffId: process.env.NEXT_PUBLIC_LIFF_ID,
          withLoginOnExternalBrowser: true,
        });
        sessionStorage.removeItem("liffRetry");
        setReady(true);
        setMsg("社員IDとメールアドレスを入力してください。");
      } catch (e) {
        setMsg(`LIFF初期化失敗: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const requestCode = async () => {
    const id = Number(employeeId);
    if (!Number.isInteger(id) || id <= 0) {
      setMsg("社員IDは正の整数で入力してください。");
      return;
    }
    const mail = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
    if (!isEmail) {
      setMsg("メール形式が正しくありません。");
      return;
    }

    try {
      setSending(true);
      const idToken = await getFreshIdToken(setMsg);
      if (!idToken) return;

      const res = await fetch("/api/liff/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          employeeId: id,
          contact: mail,
          channel: "email", // 固定
        }),
      });
      const text = await res.text();

      if (res.status === 401) {
        if (!sessionStorage.getItem("liffRetry")) {
          sessionStorage.setItem("liffRetry", "1");
          setMsg("LINEのログイン有効期限が切れました。再ログインします…");
          (await import("@line/liff")).default.login({ redirectUri: location.href });
        } else {
          setMsg("再ログインに失敗しました。LINEアプリから本ページを開き直してください。");
        }
        return;
      }

      if (res.ok) {
        setMsg("確認コードを送信しました。メールに届いた6桁コードを入力してください。");
        setStep(2);
        setCooldown(60);
      } else {
        setMsg(`コード送信失敗(${res.status}): ${text}`);
      }
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  };

  const submitBind = async () => {
    const id = Number(employeeId);
    if (!Number.isInteger(id) || id <= 0) {
      setMsg("社員IDは正の整数で入力してください。");
      return;
    }
    const code6 = code.trim();
    if (!/^\d{6}$/.test(code6)) {
      setMsg("確認コードは6桁の数字です。");
      return;
    }

    try {
      setSending(true);
      const idToken = await getFreshIdToken(setMsg);
      if (!idToken) return;

      let displayName = "";
      try {
        const liff = (await import("@line/liff")).default;
        const prof = await liff.getProfile();
        displayName = prof?.displayName ?? "";
      } catch {}

      const res = await fetch("/api/liff/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, employeeId: id, code: code6, displayName }),
      });
      const text = await res.text();

      if (res.status === 401) {
        if (!sessionStorage.getItem("liffRetry")) {
          sessionStorage.setItem("liffRetry", "1");
          setMsg("LINEのログイン有効期限が切れました。再ログインします…");
          (await import("@line/liff")).default.login({ redirectUri: location.href.split("#")[0] });
        } else {
          setMsg("再ログインに失敗しました。LINEアプリから本ページを開き直してください。");
        }
        return;
      }

      if (res.ok) {
        setMsg(`連携完了: ${text}`);
        setDone(true);
      } else {
        setMsg(`連携失敗(${res.status}): ${text}`);
      }
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  };

  if (!ready) return <p>{msg}</p>;

  return (
    <main className="p-4 space-y-3">
      <h1>従業員連携</h1>

      <label>社員ID</label>
      <input
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        className="border p-2 block"
        inputMode="numeric"
        placeholder="12345"
      />

      {step === 1 && (
        <>
          <label>メールアドレス</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 block"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestCode}
              disabled={sending || cooldown > 0}
              className="border px-4 py-2"
            >
              {cooldown > 0 ? `再送(${cooldown}s)` : sending ? "送信中…" : "確認コードを送る"}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label>確認コード（6桁）</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border p-2 block"
            inputMode="numeric"
            placeholder="123456"
          />
          <div className="flex gap-2">
            <button type="button" onClick={submitBind} disabled={sending} className="border px-4 py-2">
              {sending ? "処理中…" : "連携する"}
            </button>
            <button type="button" onClick={() => setStep(1)} className="border px-4 py-2">
              戻る
            </button>
          </div>
        </>
      )}

      {done && (
        <button onClick={() => router.push("/")} className="border px-4 py-2">
          トップへ戻る
        </button>
      )}

      <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
    </main>
  );
}
