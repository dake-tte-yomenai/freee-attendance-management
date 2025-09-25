"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./displaySalary.module.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { emailToId } from "../../utils/idToEmail/idToEmail";

export default function DisplaySalary() {
  const thisYear = useMemo(() => new Date().getFullYear(), []);
  const thisMonth = useMemo(() => new Date().getMonth() + 1, []);

  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(thisMonth);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  const params = useSearchParams();
  const [id, setId] = useState(params.get("id") ?? "");
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/");
        return;
      }
      setId(String(emailToId(u.email ?? "")));
    });
    return () => unsub();
  }, [router]);

  const load = async (y, m) => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/getSalary?employeeId=${encodeURIComponent(id)}&year=${y}&month=${m}`
      );
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
      setErr(e?.message ?? "エラーが発生しました");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const did = useRef(false);
  useEffect(() => {
    if (!id || did.current) return;
    did.current = true;
    load(year, month);
  }, [id, year, month]);

  const getSalary = (e) => {
    e.preventDefault();
    load(year, month);
  };

  const stmt = data?.employee_payroll_statement ?? null;
  const gross = stmt?.payment_amount;        // 総支給
  const net = stmt?.net_payment_amount;      // 手取り
  const name = stmt?.employee_name;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>給料一覧</h1>

      {/* ツールバー：右に年月＆表示 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft} />
        <form onSubmit={getSalary} className={styles.filters}>
          <input
            className={styles.month}
            type="month"
            value={`${year}-${String(month).padStart(2, "0")}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-");
              setYear(Number(y));
              setMonth(Number(m));
            }}
            required
          />
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            表示
          </button>
        </form>
      </div>

      {loading && <div className={styles.skel} aria-hidden />}

      {err && (
        <div className={styles.alert} role="alert">
          {err}
        </div>
      )}

      {/* 結果表示 */}
      {stmt ? (
        <section className={styles.card} aria-live="polite">
          <dl className={styles.dl}>
            <div className={styles.row}>
              <dt>氏名</dt>
              <dd>{name ?? "—"}</dd>
            </div>
            <div className={styles.row}>
              <dt>年月</dt>
              <dd>{year}年 {month}月</dd>
            </div>
            <div className={styles.row}>
              <dt>総支給</dt>
              <dd className={styles.num}>
                {gross != null ? Number(gross).toLocaleString() : "—"}円
              </dd>
            </div>
            <div className={styles.row}>
              <dt>手取り</dt>
              <dd className={styles.num}>
                {net != null ? Number(net).toLocaleString() : "—"}円
              </dd>
            </div>
          </dl>
        </section>
      ) : data ? (
        <pre className={styles.raw}>{JSON.stringify(data, null, 2)}</pre>
      ) : null}

      {/* 管理者だけの導線（IDで判定していた仕様を踏襲） */}
      {Number(id) === 3407708 ? (
        <div className={styles.footerActions}>
          <button
            className={styles.btnGhost}
            onClick={() => {
              router.push(
                `https://p.secure.freee.co.jp/payroll_statements#/1226076/${year}/${month}?page=1&utm_campaign=701Ie000000gW2uIAE_payroll_statements&utm_medium=product&utm_source=payroll`
              );
            }}
          >
            給与計算をする
          </button>
        </div>
      ) : null}
    </div>
  );
}
