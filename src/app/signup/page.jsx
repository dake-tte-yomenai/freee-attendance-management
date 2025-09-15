// app/signup/page.jsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpWithIdPassword } from "../utils/signup/signup";

export default function SignUpPage() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(null);
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) { setErr("パスワードが一致しません"); return; }
    try {
      await signUpWithIdPassword(id, pw);
      router.push(`./stamping?id=${encodeURIComponent(id)}`); // 登録後はログイン済みで遷移
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input type="text" placeholder="社員ID" value={id} onChange={e=>setId(e.target.value)} required />
      <br/>
      <input type="password" placeholder="パスワード" value={pw} onChange={e=>setPw(e.target.value)} required />
      <br/>
      <input type="password" placeholder="パスワード（確認）" value={pw2} onChange={e=>setPw2(e.target.value)} required />
      <br/>
      <button type="submit">新規登録</button>
      {err && <p style={{color:"crimson"}}>{err}</p>}
    </form>
  );
}
