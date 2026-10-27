// Pure helpers: no React Native or Firebase imports, so they can be unit tested in plain Node.
// The same rules are enforced again on the payments server (server/payments.js), so
// nothing here is trusted for money. This file only drives the UI.

export const PAYMENT_CONFIG = {
  CURRENCY: 'PHP',
  // Smallest single payment the app will ask for. Xendit also enforces minimums per payment
  // channel, so keep this at or above the lowest amount your enabled channels accept.
  MIN_PAYMENT: 100,
  DEFAULT_DOWNPAYMENT_PERCENT: 50,
  MAX_DOWNPAYMENT_PERCENT: 90,
  // Freelancers must save a payout method (Profile) before they can send an offer.
  REQUIRE_PAYOUT_METHOD: true,
  // Shows "test mode" notices next to pay buttons. Set to false when you switch to live Xendit keys.
  TEST_MODE: true,
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const toNumber = (v) => {
  const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

export const peso = (n) =>
  `₱ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ───────────────────────── Offer maths ───────────────────────── */

// Turns what the freelancer typed into exact amounts. The remaining balance is always
// total - downpayment, and a downpayment that would reach the total is rejected, so the
// two parts can never add up to more than the agreed price.
export function computeOffer({ total, downpaymentRequired, mode = 'percent', value }) {
  const min = PAYMENT_CONFIG.MIN_PAYMENT;
  const t = round2(toNumber(total));

  if (!Number.isFinite(t) || t <= 0) return { ok: false, error: 'Enter the final total price.' };
  if (t < min) return { ok: false, total: t, error: `The total must be at least ${peso(min)}.` };

  if (!downpaymentRequired) {
    return { ok: true, total: t, downpaymentRequired: false, mode: 'percent', value: 0, downpayment: 0, remaining: t };
  }

  const v = toNumber(value);
  if (!Number.isFinite(v) || v <= 0) {
    return {
      ok: false,
      total: t,
      error: mode === 'percent' ? 'Enter a downpayment percentage.' : 'Enter a downpayment amount.',
    };
  }
  if (mode === 'percent' && v > PAYMENT_CONFIG.MAX_DOWNPAYMENT_PERCENT) {
    return {
      ok: false,
      total: t,
      error: `A downpayment can be at most ${PAYMENT_CONFIG.MAX_DOWNPAYMENT_PERCENT}% of the total.`,
    };
  }

  const dp = mode === 'percent' ? round2((t * v) / 100) : round2(v);
  const rem = round2(t - dp);
  const base = { total: t, downpaymentRequired: true, mode, value: v, downpayment: dp, remaining: Math.max(rem, 0) };

  if (dp >= t) {
    return { ok: false, ...base, error: 'The downpayment must be lower than the total, so a balance is left for delivery.' };
  }
  if (dp < min) return { ok: false, ...base, error: `The downpayment must be at least ${peso(min)}.` };
  if (rem < min) {
    return { ok: false, ...base, error: `The remaining balance must be at least ${peso(min)}. Lower the downpayment.` };
  }
  return { ok: true, ...base, remaining: rem };
}

// Accepts either the computeOffer() result or the offer object stored on a booking.
export function describeOffer(o) {
  if (!o) return '';
  const total = o.total !== undefined ? o.total : o.totalPrice;
  const down = o.downpayment !== undefined ? o.downpayment : o.downpaymentAmount;
  const rest = o.remaining !== undefined ? o.remaining : o.remainingBalance;
  if (!o.downpaymentRequired) return `Total ${peso(total)}, paid in full on delivery.`;
  return `Total ${peso(total)}, downpayment ${peso(down)}, balance ${peso(rest)} on delivery.`;
}

/* ───────────────────────── Booking stages ───────────────────────── */

// Bookings created before the payment update have no `offerStatus`; they keep the old behaviour.
export const isNegotiated = (b) => !!b && b.offerStatus !== undefined && b.offerStatus !== null;

// One place that answers "where is this booking right now?" so every screen agrees.
export function getBookingStage(b) {
  if (!b) return 'unknown';
  const status = (b.status || 'pending').toLowerCase();
  if (status === 'declined' || status === 'cancelled') return status;
  if (status === 'disputed' || b.disputeStatus === 'open') return 'disputed';
  if (status === 'completed') return 'completed';
  if (!isNegotiated(b)) return status === 'pending' ? 'legacy_pending' : 'in_progress';
  if (status === 'pending') {
    if (b.offerStatus === 'accepted') return 'awaiting_downpayment';
    if (b.offerStatus === 'sent') return 'offer_sent';
    return 'negotiating';
  }
  if (b.deliveryStatus === 'submitted') return 'delivered_locked';
  return 'in_progress';
}

const STAGE_LABELS = {
  negotiating: { client: 'Negotiating', freelancer: 'Negotiating' },
  offer_sent: { client: 'Offer received', freelancer: 'Offer sent' },
  awaiting_downpayment: { client: 'Pay downpayment', freelancer: 'Awaiting downpayment' },
  in_progress: { client: 'In progress', freelancer: 'In progress' },
  delivered_locked: { client: 'Pay to unlock', freelancer: 'Awaiting final payment' },
  completed: { client: 'Completed', freelancer: 'Completed' },
  disputed: { client: 'Dispute open', freelancer: 'Dispute open' },
  declined: { client: 'Declined', freelancer: 'Declined' },
  cancelled: { client: 'Cancelled', freelancer: 'Cancelled' },
  legacy_pending: { client: 'Awaiting approval', freelancer: 'New request' },
};

export function stageLabel(stage, role = 'client') {
  const entry = STAGE_LABELS[stage];
  return entry ? entry[role] || entry.client : '';
}

/* ───────────────────────── Payout details ───────────────────────── */

const PH_MOBILE = /^(?:\+?63|0)9\d{9}$/;

// Accepts 09171234567, +639171234567, 639171234567 (spaces and dashes allowed) -> 09171234567
export function normalizePhMobile(input) {
  const digits = String(input || '').replace(/[\s\-().]/g, '');
  if (!PH_MOBILE.test(digits)) return null;
  return `0${digits.replace(/^\+?63/, '').replace(/^0/, '')}`;
}

export function validatePayoutForm({ type, name, number, bankName }) {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  if (cleanName.length < 2) {
    return { ok: false, error: 'Enter the account holder name exactly as it appears on the account.' };
  }

  if (type === 'Bank Transfer') {
    const bank = String(bankName || '').trim();
    if (!bank) return { ok: false, error: 'Enter the bank name.' };
    const account = String(number || '').replace(/[\s-]/g, '');
    if (!/^\d{6,20}$/.test(account)) {
      return { ok: false, error: 'Enter a valid bank account number (6 to 20 digits).' };
    }
    return { ok: true, name: cleanName, number: account, bankName: bank };
  }

  const mobile = normalizePhMobile(number);
  if (!mobile) {
    return { ok: false, error: `Enter the mobile number registered to your ${type} account, for example 09123456789.` };
  }
  return { ok: true, name: cleanName, number: mobile, bankName: null };
}

// "GCash, ••••4567". Only the last four digits are ever shown on screen.
export function payoutSummary(paymentMethod) {
  if (!paymentMethod || !paymentMethod.number) return null;
  const n = String(paymentMethod.number);
  const masked = n.length > 4 ? `${'•'.repeat(Math.min(n.length - 4, 6))}${n.slice(-4)}` : n;
  const label = paymentMethod.type === 'Bank Transfer' ? paymentMethod.bankName || 'Bank' : paymentMethod.type || 'Payout';
  return `${label}, ${masked}`;
}

/* ───────────────────────── Deliverable link ───────────────────────── */

// Avoids `new URL()` on purpose: React Native's URL polyfill does not implement hostname.
export function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) return { ok: false, error: 'Paste the link to your final work.' };
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const m = s.match(/^https?:\/\/([^/?#\s:]+)(:\d+)?([/?#]\S*)?$/i);
  if (!m || !m[1].includes('.')) {
    return { ok: false, error: 'That does not look like a valid link. Try something like https://drive.google.com/...' };
  }
  return { ok: true, url: s, host: m[1].toLowerCase().replace(/^www\./, '') };
}
