"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { loginWithIdPassword } from "./utils/login/login";

export default function LoginForm() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const doLogin = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await loginWithIdPassword(id, password);
      router.push(`./stamping?id=${encodeURIComponent(id)}`);
    } catch (e) {
      setErr(e?.message ?? "ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="loginTitle">
        <h1 id="loginTitle" className={styles.title}>ログイン</h1>

        <form onSubmit={doLogin} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>ID</span>
            <input
              className={styles.input}
              type="text"
              inputMode="numeric"
              autoComplete="username"
              placeholder="IDを入力"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>パスワード</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {err && (
            <div className={styles.alert} role="alert">
              {err}
            </div>
          )}

          <div className={styles.actions}>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "確認中…" : "ログイン"}
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => router.push("./signup")}
            >
              サインアップはこちら
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
