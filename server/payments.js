// Core payment logic. No Express and no firebase-admin imports here: the database and the Xendit
// client are passed in, which keeps every money rule unit-testable (see payments.test.js).
//
// Principles:
//  1. Amounts always come from the offer stored on the booking, never from the app.
//  2. A booking is only marked paid after asking Xendit itself (GET /v2/invoices/{id}).
//     Neither the app nor a webhook body is trusted for "this was paid".
//  3. Applying a payment is idempotent, so webhook + polling can both fire safely.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const PAID_STATUSES = new Set(['PAID', 'SETTLED']);
const TYPES = ['downpayment', 'final'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const peso = (n) => `₱${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ───────────── what may be charged, and how much ───────────── */

export function expectedAmount(booking, type, minPayment = 100) {
  if (!TYPES.includes(type)) throw new HttpError(400, 'Unknown payment type.');
  const offer = booking.offer;
  if (!offer || booking.offerStatus !== 'accepted') {
    throw new HttpError(409, 'The client has not accepted an offer yet.');
  }

  const total = num(offer.totalPrice);
  const down = num(offer.downpaymentAmount);
  const rest = num(offer.remainingBalance);
  const consistent =
    total > 0 &&
    rest > 0 &&
    down >= 0 &&
    Math.abs(round2(down + rest) - round2(total)) <= 0.01 &&
    (offer.downpaymentRequired ? down > 0 : down === 0);
  if (!consistent) {
    throw new HttpError(409, 'The offer amounts do not add up. Ask the freelancer to send the offer again.');
  }

  if (type === 'downpayment' && !offer.downpaymentRequired) {
    throw new HttpError(409, 'This offer has no downpayment.');
  }
  const amount = round2(type === 'downpayment' ? down : rest);
  if (amount < minPayment) throw new HttpError(409, `Payments must be at least ${peso(minPayment)}.`);
  return amount;
}

export function assertCanInvoice(booking, type, uid) {
  if (booking.clientId !== uid) throw new HttpError(403, 'Only the client of this booking can pay for it.');

  const status = (booking.status || 'pending').toLowerCase();
  if (status === 'disputed' || booking.disputeStatus === 'open') {
    throw new HttpError(409, 'Payments are paused while a dispute is open.');
  }
  const paid = (t) => booking.payments && booking.payments[t] && booking.payments[t].status === 'paid';

  if (type === 'downpayment') {
    if (status !== 'pending') throw new HttpError(409, 'This booking is not waiting for a downpayment.');
  } else {
    if (status !== 'active') throw new HttpError(409, 'The project is not active, so there is no balance to pay yet.');
    if (booking.deliveryStatus !== 'submitted') {
      throw new HttpError(409, 'The freelancer has not submitted the final work yet.');
    }
    if (booking.offer && booking.offer.downpaymentRequired && !paid('downpayment')) {
      throw new HttpError(409, 'The downpayment must be paid first.');
    }
  }
}

/* ───────────── create (or reuse) an invoice ───────────── */

export async function createOrReuseInvoice({ db, xendit, config, bookingId, type, user, now = () => new Date() }) {
  if (!TYPES.includes(type)) throw new HttpError(400, 'Unknown payment type.');

  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Booking not found.');
  const booking = snap.data();

  if (booking.clientId !== user.uid) throw new HttpError(403, 'Only the client of this booking can pay for it.');
  if (booking.payments && booking.payments[type] && booking.payments[type].status === 'paid') {
    return { alreadyPaid: true };
  }

  assertCanInvoice(booking, type, user.uid);
  const amount = expectedAmount(booking, type, config.minPayment);

  // Reuse a still-open invoice for the same amount, so the client never has two payable invoices.
  const current = booking.payments && booking.payments[type];
  if (current && current.invoiceId && current.status === 'pending' && Math.abs(num(current.amount) - amount) < 0.01) {
    try {
      const existing = await xendit.getInvoice(current.invoiceId);
      if (PAID_STATUSES.has(existing.status)) {
        await applyPaid({ db, bookingId, type, invoice: existing, now });
        return { alreadyPaid: true };
      }
      if (existing.status === 'PENDING') {
        return { invoiceUrl: existing.invoice_url, invoiceId: existing.id, amount, reused: true };
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Could not reach Xendit for the old invoice: fall through and create a fresh one.
    }
  }

  const externalId = `skillswap_${bookingId}_${type}_${now().getTime()}`;
  const label = type === 'downpayment' ? 'Downpayment' : 'Final balance';
  const invoice = await xendit.createInvoice({
    external_id: externalId,
    amount,
    currency: config.currency,
    description: `SkillSwap: ${booking.serviceTitle || 'Service'} (${label})`,
    invoice_duration: config.invoiceDuration,
    // Without a public address (APK mode) no redirect is requested and Xendit shows its own result page.
    ...(config.publicBaseUrl
      ? {
          success_redirect_url: `${config.publicBaseUrl}/payment/success`,
          failure_redirect_url: `${config.publicBaseUrl}/payment/failed`,
        }
      : {}),
    ...(user.email ? { payer_email: user.email } : {}),
  });

  const record = {
    status: 'pending',
    amount,
    invoiceId: invoice.id,
    invoiceUrl: invoice.invoice_url,
    externalId,
    expiresAt: invoice.expiry_date || null,
    createdAt: now(),
  };
  // `invoices` is a server-only ledger: it lets a webhook find its booking and audits every payment.
  await db.collection('invoices').doc(invoice.id).set({
    ...record,
    bookingId,
    type,
    clientId: booking.clientId,
    freelancerId: booking.freelancerId,
    currency: config.currency,
    xenditStatus: invoice.status || 'PENDING',
  });
  await ref.update({ [`payments.${type}`]: record, updatedAt: now() });

  return { invoiceUrl: invoice.invoice_url, invoiceId: invoice.id, amount };
}

/* ───────────── confirm a payment with Xendit and apply it ───────────── */

export async function syncInvoice({ db, xendit, bookingId, type, invoiceId = null, now = () => new Date() }) {
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Booking not found.');

  const tracked = snap.data().payments && snap.data().payments[type];
  const id = invoiceId || (tracked && tracked.invoiceId);
  if (!id) return { paid: false, status: 'NONE' };
  // Already settled by this same invoice: nothing to do. A *different* invoice for the same step
  // still has to be looked at, so a duplicate payment gets flagged instead of silently ignored.
  if (tracked && tracked.status === 'paid' && (!invoiceId || invoiceId === tracked.invoiceId)) {
    return { paid: true, status: 'PAID' };
  }

  const invoice = await xendit.getInvoice(id);
  if (PAID_STATUSES.has(invoice.status)) {
    await applyPaid({ db, bookingId, type, invoice, now });
    return { paid: true, status: invoice.status };
  }
  if (invoice.status === 'EXPIRED') {
    await db.collection('invoices').doc(id).set({ xenditStatus: 'EXPIRED' }, { merge: true });
    if (tracked && tracked.invoiceId === id && tracked.status === 'pending') {
      await ref.update({ [`payments.${type}.status`]: 'expired', updatedAt: now() });
    }
  }
  return { paid: false, status: invoice.status };
}

export async function applyPaid({ db, bookingId, type, invoice, now = () => new Date() }) {
  const bookingRef = db.collection('bookings').doc(bookingId);
  const invoiceRef = db.collection('invoices').doc(invoice.id);

  const outcome = await db.runTransaction(async (tx) => {
    const bookingSnap = await tx.get(bookingRef);
    const ledgerSnap = await tx.get(invoiceRef);
    if (!bookingSnap.exists) throw new HttpError(404, 'Booking not found.');

    const b = bookingSnap.data();
    const ledger = ledgerSnap.exists ? ledgerSnap.data() : null;
    // Only invoices this server created for this booking and payment type can complete it.
    if (!ledger || ledger.bookingId !== bookingId || ledger.type !== type) {
      return { applied: false, reason: 'unknown-invoice' };
    }

    const tracked = (b.payments && b.payments[type]) || {};
    if (tracked.status === 'paid') {
      if (tracked.invoiceId !== invoice.id) {
        // The client paid two different invoices for the same step. Flag it for a manual refund.
        tx.set(invoiceRef, { xenditStatus: invoice.status, duplicatePayment: true }, { merge: true });
        return { applied: false, reason: 'duplicate' };
      }
      return { applied: false, reason: 'already-applied' };
    }

    if (Math.abs(num(invoice.amount) - num(ledger.amount)) > 0.01) {
      throw new HttpError(409, 'The paid amount does not match the booking. This needs a manual review.');
    }

    const t = now();
    const paidAmount = num(invoice.paid_amount !== undefined ? invoice.paid_amount : invoice.amount);
    const paidAt = invoice.paid_at ? new Date(invoice.paid_at) : t;
    const status = (b.status || 'pending').toLowerCase();

    const updates = {
      [`payments.${type}`]: {
        ...tracked,
        status: 'paid',
        invoiceId: invoice.id,
        invoiceUrl: ledger.invoiceUrl || tracked.invoiceUrl || null,
        amount: ledger.amount,
        paidAmount,
        paidAt,
        paymentMethod: invoice.payment_method || null,
        paymentChannel: invoice.payment_channel || null,
      },
      amountPaid: round2((num(b.amountPaid) || 0) + paidAmount),
      updatedAt: t,
    };

    let message;
    if (type === 'downpayment') {
      if (status === 'pending') {
        updates.status = 'active';
        updates.activatedAt = t;
      }
      updates.latestNote = 'Downpayment received. The project is now active.';
      message = `Downpayment of ${peso(paidAmount)} received. The project is now active.`;
    } else {
      updates.deliveryStatus = 'unlocked';
      if (status === 'active') {
        updates.status = 'completed';
        updates.progress = 100;
        updates.completedAt = t;
      }
      updates.latestNote = 'Final payment received. The delivery is unlocked and the project is complete.';
      message = `Final payment of ${peso(paidAmount)} received. The delivery link is unlocked and the project is complete.`;
    }

    tx.update(bookingRef, updates);
    tx.set(invoiceRef, { xenditStatus: invoice.status, status: 'paid', paidAt, paidAmount }, { merge: true });
    return { applied: true, chatId: b.chatId || null, message };
  });

  if (outcome.applied && outcome.chatId) {
    await postSystemMessage(db, outcome.chatId, outcome.message, now);
  }
  return outcome;
}

async function postSystemMessage(db, chatId, text, now) {
  try {
    await db.collection('chats').doc(chatId).collection('messages').add({
      type: 'system',
      senderId: 'system',
      text,
      createdAt: now(),
    });
    await db.collection('chats').doc(chatId).update({ lastMessage: text, updatedAt: now() });
  } catch (err) {
    console.warn('Could not post the chat notice:', err.message);
  }
}

/* ───────────── entry points used by the HTTP routes ───────────── */

// "Has my payment gone through?": used by the app while it waits, by either party of the booking.
export async function checkPayment({ db, xendit, bookingId, type, uid, now }) {
  if (!TYPES.includes(type)) throw new HttpError(400, 'Unknown payment type.');
  const snap = await db.collection('bookings').doc(bookingId).get();
  if (!snap.exists) throw new HttpError(404, 'Booking not found.');
  const b = snap.data();
  if (uid !== b.clientId && uid !== b.freelancerId) throw new HttpError(403, 'You are not part of this booking.');
  return syncInvoice({ db, xendit, bookingId, type, now });
}

// Xendit's "invoice paid" callback. The body only tells us WHICH invoice to look at; whether it
// was really paid is decided by asking Xendit again inside syncInvoice().
export async function handleInvoiceCallback({ db, xendit, payload, now }) {
  const invoiceId = payload && payload.id;
  if (!invoiceId) throw new HttpError(400, 'Missing invoice id.');
  const ledger = await db.collection('invoices').doc(invoiceId).get();
  if (!ledger.exists) return { ignored: true };
  const { bookingId, type } = ledger.data();
  const result = await syncInvoice({ db, xendit, bookingId, type, invoiceId, now });
  return { ignored: false, ...result };
}
