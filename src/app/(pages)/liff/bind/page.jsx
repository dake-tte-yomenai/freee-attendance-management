// app/liff/bind/page.jsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic"; // 事前レンダ回避

export default function Page() {
  return (
    <Suspense fallback={<p>初期化中…</p>}>
      <BindInner />
    </Suspense>
  );
}

function BindInner() {
  const [employeeId, setEmployeeId] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("初期化中…");
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        setReady(true);
        setMsg("社員IDと確認コードを入力してください。");
      } catch (e) {
        setMsg(`LIFF初期化失敗: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, []);

  const submit = async () => {
    try {
      const liff = (await import("@line/liff")).default;
      const idToken = liff.getIDToken();
      if (!idToken) { setMsg("idToken が取得できません（scope=openid を確認）"); return; }

      const res = await fetch("/api/liff/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, employeeId: Number(employeeId), code })
      });
      const text = await res.text();
      setMsg(res.ok ? `連携完了: ${text}` : `連携失敗(${res.status}): ${text}`);
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      router.push("/"); // 失敗時もトップへ戻す。成功時だけ戻したい場合は try ブロック内に移動。
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
      />
      <label>確認コード</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="border p-2 block"
      />
      <button onClick={submit} className="border px-4 py-2">連携する</button>
      <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
    </main>
  );
}
