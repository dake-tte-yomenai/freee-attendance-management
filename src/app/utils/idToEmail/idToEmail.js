export function idToEmail(raw){
    const id=String(raw).trim();
    return `${id}@id.login`;
}