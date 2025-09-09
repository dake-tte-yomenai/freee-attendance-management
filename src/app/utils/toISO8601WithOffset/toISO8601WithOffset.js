export const toISO8601WithOffset = (date, time) => {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const local = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);

    const YYYY = local.getFullYear();
    const MM = String(local.getMonth() + 1).padStart(2, "0");
    const DD = String(local.getDate()).padStart(2, "0");
    const HH = String(local.getHours()).padStart(2, "0");
    const MI = String(local.getMinutes()).padStart(2, "0");
    const SS = String(local.getSeconds()).padStart(2, "0");

    return {base_date:`${YYYY}-${MM}-${DD}`,datetime:`${YYYY}-${MM}-${DD} ${HH}:${MI}:${SS}`,time:``};
  };
