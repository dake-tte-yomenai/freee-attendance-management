export const changeNotationTime = (time) => {
  if (!time) return "";
  const [hh = "00", mm = "00"] = time.split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`;
};
