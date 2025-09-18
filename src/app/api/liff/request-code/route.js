// app/api/liff/request-code/route.js
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { idToken, employeeId, contact } = await req.json();
    if (!idToken || !employeeId || !contact) {
      return new Response("idToken/employeeId/contact required", { status: 400 });
    }

    // 1) LINE IDトークン検証
    const v = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID,
      }),
    });
    const vText = await v.text();
    if (!v.ok) {
      return new Response(`verify failed: ${vText}`, { status: 401 });
    }

    // 2) メール専用に固定（誤操作防止）
    const email = String(contact).trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmail) {
      return new Response("invalid email format", { status: 400 });
    }

    // 3) バックエンドへ「コード発行+送信」を依頼
    const backend = process.env.BACKEND_BASE_URL || "http://localhost:8000";
    const r = await fetch(`${backend}/onboarding/request_code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify({
        employee_id: Number(employeeId),
        contact: email,
        channel: "email", // ← 固定
      }),
    });
    const body = await r.text();
    if (!r.ok) {
      return new Response(body, { status: r.status });
    }

    return new Response(body, {
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
