// app/api/liff/bind/route.js
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { idToken, employeeId, code, displayName = "" } = await req.json();
    if (!idToken || !employeeId || !code) {
      return new Response("idToken/employeeId/code required", { status: 400 });
    }

    // 1) LINEのIDトークン検証
    const verify = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID, // Loginチャネルの Channel ID
      }),
    });
    const verifyText = await verify.text();            // ← 変数名を統一
    if (!verify.ok) {
      return new Response(`verify failed: ${verifyText}`, { status: 401 });
    }
    const payload = JSON.parse(verifyText);            // { sub, ... }
    const lineUserId = payload.sub;

    // 2) FastAPIへ保存
    const backend = process.env.BACKEND_BASE_URL || "http://localhost:8000";
    const r2 = await fetch(`${backend}/bindings/liff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: Number(employeeId),
        line_user_id: lineUserId,
        display_name: displayName ?? "",
        code,
      }),
    });
    const body2 = await r2.text();
    if (!r2.ok) {
      // 例: 403 invalid code / 409 already linked など
      return new Response(`bind failed: ${body2}`, { status: r2.status });
    }

    return new Response(JSON.stringify({ ok: true, employeeId, lineUserId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
