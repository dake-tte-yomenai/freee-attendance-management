// src/lib/freeeFetch.js
import { getAccessToken, forceRefreshAndGetAccess } from "./freeeToken.js";

export async function freeeFetch(pathname, init = {}, companyId) {
  const base = "https://api.freee.co.jp";
  const url = new URL(pathname, base);
  if (companyId) url.searchParams.set("company_id", companyId);

  const call = async (token) => {
    const res = await fetch(url.toString(), {
      ...init,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    return res;
  };

  // 1st try
  let token = await getAccessToken();
  let res = await call(token);

  // 401 Unauthorized → 1回だけ更新してリトライ
  if (res.status === 401) {
    token = await forceRefreshAndGetAccess();
    res = await call(token);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`freee API error: ${res.status} ${text}`);
  }
  return res.json();
}
