// ユーティリティ
const pad2 = (n) => String(n).padStart(2, "0");
const fmtHM = (isoLike) => {
  if (!isoLike) return "-";
  const d = new Date(isoLike);
  if (isNaN(d.getTime())) return "-";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// APIレスポンス → 表示行 変換
export function toRows(data){
  const records =
    data?.work_records ??
    [];

  // 出勤 or 退勤のどちらかがある日だけ残す
  const workedOnly = records.filter((r) => {
    const hasIn  = !!(r?.clock_in_at);
    const hasOut = !!(r?.clock_out_at);
    return hasIn || hasOut;
  });

  return workedOnly.map((r) => {
    const date = r?.date  ?? "-";

    const clockIn =
      r?.clock_in_at ?? null;

    const clockOut =
      r?.clock_out_at ?? null;

    // 休憩は無くてもOK。最初の一件だけ拾う（無ければ "-")
    const br = Array.isArray(r?.break_records) ? r.break_records : [];
    const br0 = br[0] || {};
    const breakBegin =
      br0?.break_begin_at ?? br0?.start_at ?? br0?.clock_in_at ?? null;
    const breakEnd =
      br0?.break_end_at ?? br0?.end_at ?? br0?.clock_out_at ?? null;

    return {
      date: String(date),
      clock_in: fmtHM(clockIn),
      break_begin: fmtHM(breakBegin),
      break_end: fmtHM(breakEnd),
      clock_out: fmtHM(clockOut),
      raw: r,
    };
  });
};
