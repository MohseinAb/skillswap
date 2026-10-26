// Tiny Xendit client. Only the two Invoice calls SkillSwap needs, using plain fetch (Node 18+).
// Docs: https://docs.xendit.co/ (Invoices API: POST /v2/invoices, GET /v2/invoices/{id})

export function createXenditClient({
  secretKey,
  baseUrl = 'https://api.xendit.co',
  fetchImpl = fetch,
  timeoutMs = 15000,
}) {
  // Xendit uses HTTP Basic auth: the secret key is the username and the password is empty.
  const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

  async function call(method, path, body) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Xendit responded with ${res.status}`);
      err.xendit = true;
      err.status = res.status;
      err.code = data.error_code;
      throw err;
    }
    return data;
  }

  return {
    createInvoice: (payload) => call('POST', '/v2/invoices', payload),
    getInvoice: (invoiceId) => call('GET', `/v2/invoices/${encodeURIComponent(invoiceId)}`),
  };
}
