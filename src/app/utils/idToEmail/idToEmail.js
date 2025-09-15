export function idToEmail(raw){
    const id=String(raw).trim();
    return `${id}@id.login`;
}
export function emailToId(email) {
  return String(email).split("@")[0];
}