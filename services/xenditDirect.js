// Calls Xendit straight from the phone, so a demo needs no server.
//
// TEST KEYS ONLY. Anything inside an APK can be extracted, so a key here is not secret.
// That is acceptable for a test-mode school project (a test key can only create fake test
// invoices) and unacceptable for real money, so live keys are refused outright.

const BASE_URL = 'https://api.xendit.co';
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Small base64 encoder (ASCII only) so this does not depend on btoa or Buffer being available.
export function toBase64(input) {
  let out = '';
  for (let i = 0; i < input.length; i += 3) {
    const a = input.charCodeAt(i);
    const b = input.charCodeAt(i + 1);
    const c = input.charCodeAt(i + 2);
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63];
    out += Number.isNaN(b) ? '=' : CHARS[(n >> 6) & 63];
    out += Number.isNaN(c) ? '=' : CHARS[n & 63];
  }
  return out;
}

export function createDirectXenditClient(secretKey, fetchImpl = fetch, timeoutMs = 15000) {
  if (!String(secretKey).startsWith('xnd_development_')) {
    throw new Error('Only Xendit TEST keys (xnd_development_...) can be used inside the app.');
  }
  const authorization = `Basic ${toBase64(`${secretKey}:`)}`;

  async function call(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${BASE_URL}${path}`, {
        method,
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      throw Object.assign(new Error('Could not reach Xendit. Check the phone\'s internet connection and try again.'), {
        xendit: true,
        network: true,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(data.message || `Xendit responded with ${res.status}`), {
        xendit: true,
        status: res.status,
        code: data.error_code,
      });
    }
    return data;
  }

  return {
    createInvoice: (payload) => call('POST', '/v2/invoices', payload),
    getInvoice: (invoiceId) => call('GET', `/v2/invoices/${encodeURIComponent(invoiceId)}`),
  };
}
