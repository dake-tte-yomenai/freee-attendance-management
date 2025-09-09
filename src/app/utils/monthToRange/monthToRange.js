export function monthToRange(ym) {
  if (!ym) return null;                 
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(); 
  const mm = String(m).padStart(2, "0");
  return { from_date: `${y}-${mm}-01`, to_date: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}
