// app/api/liff/verify-and-bind/route.js
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return Response.json({ error: "idToken required" }, { status: 400 });

    const verify = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID, // ← Loginチャネルの Channel ID
      }),
    });

    const text = await verify.text();
    if (!verify.ok) {
      return Response.json({ ok:false, step:"verify", detail:text }, { status: verify.status });
    }

    const data = JSON.parse(text); // { sub, name, picture, ... }
    const lineUserId = data.sub;   // ← これが push 先の userId

    // ここで DB に保存（従業員IDの入力方式は運用に合わせて）
    // 例）暫定で自分用ダミー保存・または query/cookie で employeeId を受ける等
    // await saveBinding({ employeeId, lineUserId });

    return Response.json({ ok:true, lineUserId });
  } catch (e) {
    return Response.json({ ok:false, error:String(e) }, { status: 500 });
  }
}
