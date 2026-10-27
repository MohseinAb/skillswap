// Run with:  npm test      (Node 18+, no extra packages needed)
// Uses an in-memory stand-in for Firestore and a fake Xendit, so no keys or network are involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrReuseInvoice, syncInvoice, checkPayment, handleInvoiceCallback, expectedAmount, HttpError,
} from './payments.js';

/* ───────────── in-memory Firestore (just the calls payments.js uses) ───────────── */

const clone = (v) => structuredClone(v);

function setDotted(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null || cur[keys[i]] instanceof Date) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

class FakeDb {
  constructor() {
    this.docs = new Map();
    this.autoId = 0;
    this.lock = Promise.resolve();
  }

  collection(name) {
    return new FakeCollection(this, name);
  }

  // Transactions run one at a time, like Firestore's optimistic transactions that retry on contention.
  runTransaction(fn) {
    const run = async () => {
      const queued = [];
      const tx = {
        get: (ref) => ref.get(),
        update: (ref, patch) => queued.push(() => ref.update(patch)),
        set: (ref, data, opts) => queued.push(() => ref.set(data, opts)),
      };
      const result = await fn(tx);
      for (const q of queued) await q();
      return result;
    };
    const next = this.lock.then(run, run);
    this.lock = next.catch(() => {});
    return next;
  }
}

class FakeCollection {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }
  doc(id) {
    return new FakeDoc(this.db, `${this.path}/${id}`, id);
  }
  async add(data) {
    const id = `auto${++this.db.autoId}`;
    await this.doc(id).set(data);
    return this.doc(id);
  }
}

class FakeDoc {
  constructor(db, path, id) {
    this.db = db;
    this.path = path;
    this.id = id;
  }
  collection(name) {
    return new FakeCollection(this.db, `${this.path}/${name}`);
  }
  async get() {
    const v = this.db.docs.get(this.path);
    return { exists: v !== undefined, id: this.id, data: () => clone(v) };
  }
  async set(data, opts = {}) {
    const existing = this.db.docs.get(this.path);
    this.db.docs.set(this.path, opts.merge && existing ? { ...existing, ...clone(data) } : clone(data));
  }
  async update(patch) {
    const existing = this.db.docs.get(this.path);
    if (existing === undefined) throw new Error(`No document to update: ${this.path}`);
    const next = clone(existing);
    for (const [k, v] of Object.entries(patch)) setDotted(next, k, v instanceof Date ? v : clone(v));
    this.db.docs.set(this.path, next);
  }
}

/* ───────────── fake Xendit ───────────── */

function makeXendit() {
  const invoices = new Map();
  let n = 0;
  return {
    invoices,
    created: 0,
    async createInvoice(payload) {
      this.created += 1;
      const id = `inv_${++n}`;
      invoices.set(id, {
        id,
        external_id: payload.external_id,
        amount: payload.amount,
        currency: payload.currency,
        status: 'PENDING',
        invoice_url: `https://checkout.test/${id}`,
        expiry_date: '2099-01-01T00:00:00Z',
        _payload: payload,
      });
      return clone(invoices.get(id));
    },
    async getInvoice(id) {
      const inv = invoices.get(id);
      if (!inv) throw Object.assign(new Error('Invoice not found'), { xendit: true, status: 404 });
      return clone(inv);
    },
    pay(id, extra = {}) {
      const inv = invoices.get(id);
      Object.assign(inv, {
        status: 'PAID',
        paid_amount: inv.amount,
        paid_at: '2026-10-26T10:00:00Z',
        payment_method: 'EWALLET',
        payment_channel: 'GCASH',
        ...extra,
      });
    },
  };
}

/* ───────────── fixtures ───────────── */

const config = { currency: 'PHP', minPayment: 100, invoiceDuration: 86400, publicBaseUrl: 'http://localhost:4000' };
const client = { uid: 'client1', email: 'client@example.ph' };

function seed(db, overrides = {}, offerOverrides = {}) {
  db.docs.set('bookings/b1', {
    clientId: 'client1',
    freelancerId: 'free1',
    serviceTitle: 'Logo design',
    chatId: 'chat1',
    status: 'pending',
    offerStatus: 'accepted',
    deliveryStatus: 'none',
    amountPaid: 0,
    progress: 0,
    offer: {
      totalPrice: 5000,
      downpaymentRequired: true,
      downpaymentType: 'percent',
      downpaymentValue: 50,
      downpaymentAmount: 2500,
      remainingBalance: 2500,
      ...offerOverrides,
    },
    ...overrides,
  });
  db.docs.set('chats/chat1', { participants: ['client1', 'free1'] });
}

const read = (db, path) => clone(db.docs.get(path));
const chatNotices = (db) => [...db.docs.keys()].filter((k) => k.startsWith('chats/chat1/messages/'));
const invoice = (db, x, type, who = client) =>
  createOrReuseInvoice({ db, xendit: x, config, bookingId: 'b1', type, user: who });
const check = (db, x, type, uid = 'client1') => checkPayment({ db, xendit: x, bookingId: 'b1', type, uid });
const rejectsWith = (promise, status, pattern) =>
  assert.rejects(promise, (e) => e instanceof HttpError && e.status === status && (!pattern || pattern.test(e.message)));

/* ───────────── tests ───────────── */

test('expectedAmount follows the accepted offer and refuses inconsistent ones', () => {
  const b = (o = {}, extra = {}) => ({
    offerStatus: 'accepted',
    offer: { totalPrice: 5000, downpaymentRequired: true, downpaymentAmount: 2500, remainingBalance: 2500, ...o },
    ...extra,
  });
  assert.equal(expectedAmount(b(), 'downpayment'), 2500);
  assert.equal(expectedAmount(b(), 'final'), 2500);
  assert.equal(expectedAmount(b({ downpaymentRequired: false, downpaymentAmount: 0, remainingBalance: 5000 }), 'final'), 5000);
  assert.throws(() => expectedAmount(b({ downpaymentRequired: false, downpaymentAmount: 0, remainingBalance: 5000 }), 'downpayment'), /no downpayment/);
  assert.throws(() => expectedAmount(b({ remainingBalance: 2600 }), 'final'), /do not add up/); // 2500 + 2600 != 5000
  assert.throws(() => expectedAmount(b({ downpaymentAmount: 5000, remainingBalance: 0 }), 'final'), /do not add up/);
  assert.throws(() => expectedAmount(b({ downpaymentAmount: 50, remainingBalance: 4950 }), 'downpayment'), /at least/);
  assert.throws(() => expectedAmount(b({}, { offerStatus: 'sent' }), 'downpayment'), /not accepted/);
  assert.throws(() => expectedAmount({}, 'downpayment'), /not accepted/);
  assert.throws(() => expectedAmount(b(), 'refund'), /Unknown payment type/);
});

test('full lifecycle: downpayment activates the project, final payment completes and unlocks it', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);

  // 1. downpayment invoice: amount comes from the offer, with the right currency and redirects
  const inv1 = await invoice(db, x, 'downpayment');
  assert.equal(inv1.amount, 2500);
  const payload = x.invoices.get(inv1.invoiceId)._payload;
  assert.deepEqual(
    [payload.amount, payload.currency, payload.payer_email, payload.invoice_duration],
    [2500, 'PHP', 'client@example.ph', 86400]
  );
  assert.match(payload.success_redirect_url, /\/payment\/success$/);
  assert.match(payload.description, /Logo design \(Downpayment\)/);
  assert.equal(read(db, 'bookings/b1').payments.downpayment.status, 'pending');
  assert.equal(read(db, `invoices/${inv1.invoiceId}`).bookingId, 'b1');

  // 2. asking again reuses the open invoice instead of creating a second one
  const again = await invoice(db, x, 'downpayment');
  assert.equal(again.reused, true);
  assert.equal(again.invoiceId, inv1.invoiceId);
  assert.equal(x.created, 1);

  // 3. not paid yet: nothing changes
  assert.equal((await check(db, x, 'downpayment')).paid, false);
  assert.equal(read(db, 'bookings/b1').status, 'pending');

  // 4. paid in Xendit: the project becomes active, money is recorded, the chat is told
  x.pay(inv1.invoiceId);
  assert.equal((await check(db, x, 'downpayment')).paid, true);
  let b = read(db, 'bookings/b1');
  assert.equal(b.status, 'active');
  assert.equal(b.amountPaid, 2500);
  assert.equal(b.payments.downpayment.status, 'paid');
  assert.equal(b.payments.downpayment.paidAmount, 2500);
  assert.equal(b.payments.downpayment.paymentChannel, 'GCASH');
  assert.ok(b.activatedAt);
  assert.equal(chatNotices(db).length, 1);
  assert.match(read(db, 'chats/chat1').lastMessage, /Downpayment of ₱2,500.00 received/);

  // 5. checking again is harmless (idempotent)
  await check(db, x, 'downpayment');
  assert.equal(read(db, 'bookings/b1').amountPaid, 2500);
  assert.equal(chatNotices(db).length, 1);
  assert.equal((await invoice(db, x, 'downpayment').catch((e) => e)).alreadyPaid, true);

  // 6. the final balance cannot be invoiced until the work is submitted
  await rejectsWith(invoice(db, x, 'final'), 409, /not submitted/);
  db.docs.set('bookings/b1', { ...read(db, 'bookings/b1'), deliveryStatus: 'submitted' });

  // 7. final invoice, payment, unlock
  const inv2 = await invoice(db, x, 'final');
  assert.equal(inv2.amount, 2500);
  x.pay(inv2.invoiceId);
  assert.equal((await check(db, x, 'final')).paid, true);
  b = read(db, 'bookings/b1');
  assert.equal(b.status, 'completed');
  assert.equal(b.deliveryStatus, 'unlocked');
  assert.equal(b.progress, 100);
  assert.equal(b.amountPaid, 5000);
  assert.ok(b.completedAt);
  assert.equal(chatNotices(db).length, 2);
});

test('an offer without a downpayment is paid once, on delivery', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db, { status: 'active', deliveryStatus: 'submitted' }, { totalPrice: 3000, downpaymentRequired: false, downpaymentAmount: 0, remainingBalance: 3000 });
  await rejectsWith(invoice(db, x, 'downpayment'), 409, /not waiting for a downpayment/);
  // even if the data were in an odd state (pending), the offer itself has no downpayment to charge
  db.docs.set('bookings/b1', { ...read(db, 'bookings/b1'), status: 'pending', deliveryStatus: 'none' });
  await rejectsWith(invoice(db, x, 'downpayment'), 409, /no downpayment/);
  db.docs.set('bookings/b1', { ...read(db, 'bookings/b1'), status: 'active', deliveryStatus: 'submitted' });
  assert.equal(x.created, 0);
  const inv = await invoice(db, x, 'final');
  assert.equal(inv.amount, 3000);
  x.pay(inv.invoiceId);
  await check(db, x, 'final');
  const b = read(db, 'bookings/b1');
  assert.deepEqual([b.status, b.deliveryStatus, b.amountPaid], ['completed', 'unlocked', 3000]);
});

test('only the client can pay, and only at the right moments', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  await rejectsWith(invoice(db, x, 'downpayment', { uid: 'free1', email: 'f@x.ph' }), 403);
  await rejectsWith(invoice(db, x, 'downpayment', { uid: 'stranger' }), 403);
  await rejectsWith(invoice(db, x, 'refund'), 400);
  await rejectsWith(createOrReuseInvoice({ db, xendit: x, config, bookingId: 'nope', type: 'downpayment', user: client }), 404);

  seed(db, { offerStatus: 'sent' });
  await rejectsWith(invoice(db, x, 'downpayment'), 409, /not accepted/);
  seed(db, { status: 'disputed' });
  await rejectsWith(invoice(db, x, 'downpayment'), 409, /dispute/);
  seed(db, { status: 'active' });
  await rejectsWith(invoice(db, x, 'downpayment'), 409, /not waiting for a downpayment/);
  seed(db, { status: 'active', deliveryStatus: 'submitted', payments: { downpayment: { status: 'pending' } } });
  await rejectsWith(invoice(db, x, 'final'), 409, /downpayment must be paid first/);
  assert.equal(x.created, 0, 'no invoice may be created for a rejected request');
});

test('tampered or inconsistent offers never reach Xendit', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db, {}, { remainingBalance: 9999 });
  await rejectsWith(invoice(db, x, 'downpayment'), 409, /do not add up/);
  seed(db, {}, { downpaymentAmount: 40, remainingBalance: 4960 });
  await rejectsWith(invoice(db, x, 'downpayment'), 409, /at least/);
  assert.equal(x.created, 0);
});

test('a forged webhook cannot mark a booking as paid: Xendit is asked again', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  const inv = await invoice(db, x, 'downpayment');

  // body claims PAID, but Xendit says PENDING
  const forged = await handleInvoiceCallback({ db, xendit: x, payload: { id: inv.invoiceId, status: 'PAID', amount: 2500, paid_amount: 2500 } });
  assert.equal(forged.paid, false);
  assert.equal(read(db, 'bookings/b1').status, 'pending');
  assert.equal(read(db, 'bookings/b1').amountPaid, 0);

  // unknown invoices are ignored, malformed ones rejected
  assert.deepEqual(await handleInvoiceCallback({ db, xendit: x, payload: { id: 'someone-elses' } }), { ignored: true });
  await rejectsWith(handleInvoiceCallback({ db, xendit: x, payload: {} }), 400);

  // the real thing
  x.pay(inv.invoiceId);
  const real = await handleInvoiceCallback({ db, xendit: x, payload: { id: inv.invoiceId } });
  assert.equal(real.paid, true);
  assert.equal(read(db, 'bookings/b1').status, 'active');
});

test('a paid amount that differs from the booking is refused for manual review', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  const inv = await invoice(db, x, 'downpayment');
  x.invoices.get(inv.invoiceId).amount = 1; // pretend the invoice amount changed
  x.pay(inv.invoiceId);
  await rejectsWith(check(db, x, 'downpayment'), 409, /manual review/);
  assert.equal(read(db, 'bookings/b1').status, 'pending');
  assert.equal(read(db, 'bookings/b1').amountPaid, 0);
});

test('webhook and polling firing together still apply the payment once', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  const inv = await invoice(db, x, 'downpayment');
  x.pay(inv.invoiceId);
  await Promise.all([
    check(db, x, 'downpayment'),
    check(db, x, 'downpayment'),
    handleInvoiceCallback({ db, xendit: x, payload: { id: inv.invoiceId } }),
    syncInvoice({ db, xendit: x, bookingId: 'b1', type: 'downpayment' }),
    check(db, x, 'downpayment'),
  ]);
  assert.equal(read(db, 'bookings/b1').amountPaid, 2500);
  assert.equal(chatNotices(db).length, 1);
});

test('expired invoices are marked and replaced by a fresh one', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  const first = await invoice(db, x, 'downpayment');
  x.invoices.get(first.invoiceId).status = 'EXPIRED';
  const r = await check(db, x, 'downpayment');
  assert.deepEqual([r.paid, r.status], [false, 'EXPIRED']);
  assert.equal(read(db, 'bookings/b1').payments.downpayment.status, 'expired');

  const second = await invoice(db, x, 'downpayment');
  assert.notEqual(second.invoiceId, first.invoiceId);
  assert.equal(x.created, 2);
  assert.equal(read(db, 'bookings/b1').payments.downpayment.invoiceId, second.invoiceId);
});

test('paying a second invoice for the same step is flagged, not double counted', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  const a = await invoice(db, x, 'downpayment');
  x.invoices.get(a.invoiceId).status = 'EXPIRED';
  const b = await invoice(db, x, 'downpayment'); // replaces A
  x.pay(b.invoiceId);
  await check(db, x, 'downpayment');
  assert.equal(read(db, 'bookings/b1').amountPaid, 2500);

  // ...then the old invoice somehow also gets paid
  x.pay(a.invoiceId);
  const res = await handleInvoiceCallback({ db, xendit: x, payload: { id: a.invoiceId } });
  assert.equal(res.paid, true);
  assert.equal(read(db, 'bookings/b1').amountPaid, 2500, 'must not be counted twice');
  assert.equal(read(db, `invoices/${a.invoiceId}`).duplicatePayment, true);
});

test('either party may check a payment, nobody else', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  await invoice(db, x, 'downpayment');
  assert.equal((await check(db, x, 'downpayment', 'free1')).paid, false);
  await rejectsWith(check(db, x, 'downpayment', 'stranger'), 403);
  await rejectsWith(check(db, x, 'refund'), 400);
  assert.deepEqual(await check(db, x, 'final'), { paid: false, status: 'NONE' });
});

test('a payment that arrives during a dispute is recorded without changing the dispute status', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db, { status: 'active', deliveryStatus: 'submitted', payments: { downpayment: { status: 'paid', invoiceId: 'old' } }, amountPaid: 2500 });
  const inv = await invoice(db, x, 'final');
  db.docs.set('bookings/b1', { ...read(db, 'bookings/b1'), status: 'disputed' }); // dispute opened while the client was paying
  x.pay(inv.invoiceId);
  await check(db, x, 'final');
  const b = read(db, 'bookings/b1');
  assert.equal(b.status, 'disputed');
  assert.equal(b.amountPaid, 5000);
  assert.equal(b.deliveryStatus, 'unlocked');
});

test('without a public address no redirect urls are sent to Xendit', async () => {
  const db = new FakeDb();
  const x = makeXendit();
  seed(db);
  const inv = await createOrReuseInvoice({ db, xendit: x, config: { ...config, publicBaseUrl: '' }, bookingId: 'b1', type: 'downpayment', user: client });
  const sent = x.invoices.get(inv.invoiceId)._payload;
  assert.equal('success_redirect_url' in sent, false);
  assert.equal('failure_redirect_url' in sent, false);
  assert.equal(sent.amount, 2500);
});
