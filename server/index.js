import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createXenditClient } from './xendit.js';
import { HttpError, createOrReuseInvoice, checkPayment, handleInvoiceCallback } from './payments.js';

/* ───────────── configuration ───────────── */

function fail(message) {
  console.error(`\n[payments] ${message}\n`);
  process.exit(1);
}

const secretKey = (process.env.XENDIT_SECRET_KEY || '').trim();
if (!secretKey) fail('XENDIT_SECRET_KEY is missing. Copy .env.example to .env and fill it in.');

// A live key moves real money. This server is set up for test mode, so refuse one by accident.
const isLiveKey = secretKey.startsWith('xnd_production_');
if (isLiveKey && process.env.ALLOW_LIVE_KEYS !== 'true') {
  fail('That is a LIVE Xendit key (xnd_production_...). Use your test key (xnd_development_...), or set ALLOW_LIVE_KEYS=true if you really mean it.');
}

const port = Number(process.env.PORT || 4000);
const config = {
  currency: 'PHP',
  minPayment: Number(process.env.MIN_PAYMENT || 100),
  invoiceDuration: Number(process.env.INVOICE_DURATION_SECONDS || 86400),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
};
const callbackToken = (process.env.XENDIT_CALLBACK_TOKEN || '').trim();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

try {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  initializeApp({
    credential: keyPath ? cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) : applicationDefault(),
  });
} catch (err) {
  fail(`Could not start Firebase Admin: ${err.message}\nSet FIREBASE_SERVICE_ACCOUNT_PATH to your service account JSON file.`);
}

const db = getFirestore();
const xendit = createXenditClient({ secretKey });

/* ───────────── helpers ───────────── */

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function sendError(res, err) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err && err.xendit) {
    console.error('Xendit error:', err.status, err.code, err.message);
    return res.status(502).json({ error: `Xendit: ${err.message}` });
  }
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on the payments server.' });
}

// Wraps an async handler so any thrown error becomes a JSON response.
const route = (fn) => (req, res) => fn(req, res).catch((err) => sendError(res, err));

// Every app call carries the person's Firebase login token. We never take a user id from the body.
async function requireUser(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Please log in again.' });
  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email || null };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session expired. Please log in again.' });
  }
}

function readBookingRequest(req) {
  const { bookingId, type } = req.body || {};
  if (typeof bookingId !== 'string' || !bookingId.trim()) throw new HttpError(400, 'Missing bookingId.');
  return { bookingId: bookingId.trim(), type };
}

/* ───────────── app ───────────── */

const app = express();
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, mode: isLiveKey ? 'live' : 'test', webhook: Boolean(callbackToken) });
});

// The app asks for an invoice. The amount is worked out here from the accepted offer.
app.post('/api/payments/invoice', requireUser, route(async (req, res) => {
  const { bookingId, type } = readBookingRequest(req);
  res.json(await createOrReuseInvoice({ db, xendit, config, bookingId, type, user: req.user }));
}));

// The app asks "did my payment go through?". We ask Xendit, then update the booking if it did.
app.post('/api/payments/check', requireUser, route(async (req, res) => {
  const { bookingId, type } = readBookingRequest(req);
  res.json(await checkPayment({ db, xendit, bookingId, type, uid: req.user.uid }));
}));

// Optional: Xendit's "invoice paid" callback (needs a public URL such as ngrok or a deployed server).
app.post('/api/xendit/webhook', route(async (req, res) => {
  if (!callbackToken || !safeEqual(req.get('x-callback-token') || '', callbackToken)) {
    return res.status(401).json({ error: 'Invalid callback token.' });
  }
  const result = await handleInvoiceCallback({ db, xendit, payload: req.body });
  return res.json({ ok: true, ...result });
}));

const page = (title, message) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071c14;color:#f2fbf7;font-family:system-ui,sans-serif}
main{max-width:420px;padding:32px;text-align:center}h1{font-size:24px;margin:0 0 12px}p{color:#9dbbae;line-height:1.5;margin:0}</style>
</head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

app.get('/payment/success', (req, res) => {
  res.type('html').send(page('Payment received', 'Thank you! You can close this tab and go back to SkillSwap. The app updates by itself in a few seconds.'));
});
app.get('/payment/failed', (req, res) => {
  res.type('html').send(page('Payment not completed', 'The payment was not completed. Go back to SkillSwap and try again from your booking.'));
});

app.listen(port, () => {
  console.log(`SkillSwap payments server running on port ${port} (${isLiveKey ? 'LIVE' : 'test'} mode)`);
  console.log(`Xendit redirects people back to: ${config.publicBaseUrl}`);
  if (!callbackToken) {
    console.log('XENDIT_CALLBACK_TOKEN is not set, so the webhook is off. That is fine for testing: the app checks Xendit directly.');
  }
});
