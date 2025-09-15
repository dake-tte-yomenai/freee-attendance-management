// app/api/liff/bind/route.js
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { idToken, employeeId, code } = await req.json();
    if (!idToken || !employeeId || !code) {
      return Response.json({ error: "idToken/employeeId/code required" }, { status: 400 });
    }

    // 1) LINEのIDトークン検証（Loginチャネルの Channel ID を使用）
    const verify = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID, // ★Loginチャネル
      }),
    });
    const t = await verify.text();
    if (!verify.ok) return new Response(`verify failed: ${t}`, { status: 401 });

    const payload = JSON.parse(t);             // {sub, name, picture, ...}
    const lineUserId = payload.sub;

    // 2) プロフィール（任意）
    let displayName = "";
    try {
      // 取らずに空でも構いません（ここでは LIFF から直接取っていないので省略可）
      displayName = "";
    } catch {}

    // 3) FastAPIへ保存（/bindings/liff）
    const backend = process.env.BACKEND_BASE_URL || "http://localhost:8000";
    const r2 = await fetch(`${backend}/bindings/liff`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        employee_id: employeeId,
        line_user_id: lineUserId,
        display_name: displayName,
        code,
      }),
    });
    const body2 = await r2.text();
    if (!r2.ok) return new Response(`bind failed: ${body2}`, { status: r2.status });

    return Response.json({ ok:true, employeeId, lineUserId });
  } catch (e) {
    return Response.json({ ok:false, error:String(e) }, { status: 500 });
  }
}
