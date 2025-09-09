// Node ランタイム専用
import 'server-only';
import request from 'request';

const TOKEN_URL = process.env.FREEE_TOKEN_ENDPOINT;

export function exchangeCodeForTokens({ code, redirect_uri, client_id, client_secret }) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: TOKEN_URL,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: {
        grant_type: 'authorization_code',
        redirect_uri,
        client_id,
        client_secret,
        code,
      },
      json: true,
    }, (err, res, body) => {
      if (err) return reject(err);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`exchange failed: ${res.statusCode} ${JSON.stringify(body)}`));
      }
      resolve(body); // { access_token, refresh_token, ... }
    });
  });
}

export function refreshTokens({ refresh_token, client_id, client_secret }) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: TOKEN_URL,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: {
        grant_type: 'refresh_token',
        client_id,
        client_secret,
        refresh_token,
      },
      json: true,
    }, (err, res, body) => {
      if (err) return reject(err);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`refresh failed: ${res.statusCode} ${JSON.stringify(body)}`));
      }
      resolve(body); // { access_token, refresh_token, expires_in, ... }
    });
  });
}
