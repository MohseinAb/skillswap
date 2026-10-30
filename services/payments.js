import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { PAYMENT_CONFIG } from './paymentRules';
import { createOrReuseInvoice, checkPayment } from './paymentCore';
import { createDirectXenditClient } from './xenditDirect';
import { adminLikeDb } from './firestoreAdapter';
import { notifyUser } from './notifications';
import { messages } from './pushMessages';

// Where the payments server (the /server folder) is running.
//  - Same computer as the Expo web preview:  http://localhost:4000
//  - Real phone on your Wi-Fi:               http://<your computer's LAN IP>:4000
// Set EXPO_PUBLIC_PAYMENTS_API_URL in a .env file at the app root (Expo SDK 49+), or edit the fallback below.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_PAYMENTS_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

/*
  Two ways to run payments:

  APK mode (no laptop, no server): the app talks to Xendit and Firebase itself.
    Used automatically on a phone when EXPO_PUBLIC_XENDIT_TEST_KEY is set. TEST KEYS ONLY.

  Server mode: the app asks the /server folder, which holds the key. Used on web, or when you set
    EXPO_PUBLIC_PAYMENTS_MODE=server. (Browsers cannot call Xendit directly, so web needs the server.)

  EXPO_PUBLIC_PAYMENTS_MODE=direct or =server forces one of them.
*/
const DIRECT_KEY = (process.env.EXPO_PUBLIC_XENDIT_TEST_KEY || '').trim();
const MODE = process.env.EXPO_PUBLIC_PAYMENTS_MODE;
export const DIRECT_MODE = MODE === 'direct' || (MODE !== 'server' && Platform.OS !== 'web' && DIRECT_KEY !== '');

const WATCH_INTERVAL_MS = 4000;
const WATCH_TIMEOUT_MS = 10 * 60 * 1000;

async function post(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('Your session expired. Please log in again.');
  const token = await user.getIdToken();

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (Platform.OS !== 'web' && API_BASE_URL.includes('localhost')) {
      throw new Error('This build is not set up for payments. Add EXPO_PUBLIC_XENDIT_TEST_KEY (a xnd_development_ test key) and rebuild the app.');
    }
    throw new Error(`Cannot reach the payments server at ${API_BASE_URL}. Make sure it is running and the address is correct.`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The payments server returned an error (${res.status}).`);
  return data;
}

// APK mode: the same payment rules as the server, run inside the app.
let directContext = null;
function direct() {
  if (!directContext) {
    if (!DIRECT_KEY) {
      throw new Error('This build has no Xendit test key. Add EXPO_PUBLIC_XENDIT_TEST_KEY and rebuild the app.');
    }
    directContext = {
      db: adminLikeDb(db),
      xendit: createDirectXenditClient(DIRECT_KEY),
      // No public address in APK mode, so no redirect is requested: Xendit shows its own result page.
      config: { currency: PAYMENT_CONFIG.CURRENCY, minPayment: PAYMENT_CONFIG.MIN_PAYMENT, invoiceDuration: 86400, publicBaseUrl: '' },
      // Tell the freelancer the moment a payment is recorded.
      notify: ({ type, bookingId, amount, booking }) =>
        notifyUser(booking.freelancerId, messages.paymentReceived({ clientName: booking.clientName, serviceTitle: booking.serviceTitle, type, amount, bookingId })),
    };
  }
  return directContext;
}

async function runDirect(fn) {
  const current = auth.currentUser;
  if (!current) throw new Error('Your session expired. Please log in again.');
  try {
    return await fn(direct(), { uid: current.uid, email: current.email || null });
  } catch (err) {
    if (err && err.xendit) throw new Error(err.network ? err.message : `Xendit: ${err.message}`);
    throw err;
  }
}

// type: 'downpayment' | 'final'. The amount is worked out from the accepted offer;
// the app never sends an amount.
export const createInvoice = (bookingId, type) =>
  DIRECT_MODE
    ? runDirect((ctx, user) => createOrReuseInvoice({ ...ctx, bookingId, type, user }))
    : post('/api/payments/invoice', { bookingId, type });

export const checkInvoice = (bookingId, type) =>
  DIRECT_MODE
    ? runDirect((ctx, user) => checkPayment({ ...ctx, bookingId, type, uid: user.uid }))
    : post('/api/payments/check', { bookingId, type });

// Browsers block pop-ups opened after an await, so open the tab first (inside the tap
// handler) and point it at the checkout once the invoice exists.
export function prepareCheckoutWindow() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.open('', '_blank');
  } catch (e) {
    return null;
  }
}

export async function openCheckout(url, preparedWindow) {
  if (preparedWindow && !preparedWindow.closed) {
    preparedWindow.location.href = url;
    return;
  }
  await Linking.openURL(url);
}

// After the checkout is opened, ask the server every few seconds whether Xendit has
// confirmed the payment. The booking itself is updated by the server, and the screen's
// Firestore listener picks the change up, so this hook only decides when to stop waiting.
export function usePaymentWatcher(bookingId, options = {}) {
  const [waitingFor, setWaitingFor] = useState(null);
  const onPaidRef = useRef(options.onPaid);
  onPaidRef.current = options.onPaid;

  const checkNow = useCallback(
    async (type) => {
      try {
        const result = await checkInvoice(bookingId, type);
        if (result.paid) {
          setWaitingFor(null);
          if (onPaidRef.current) onPaidRef.current(type);
        }
        return result;
      } catch (e) {
        return { paid: false, error: e.message };
      }
    },
    [bookingId]
  );

  useEffect(() => {
    if (!waitingFor) return undefined;
    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const result = await checkInvoice(bookingId, waitingFor);
        if (cancelled) return;
        if (result.paid) {
          setWaitingFor(null);
          if (onPaidRef.current) onPaidRef.current(waitingFor);
          return;
        }
        if (result.status === 'EXPIRED') {
          setWaitingFor(null);
          return;
        }
      } catch (e) {
        // Server unreachable for a moment: keep trying until the timeout.
      }
      if (!cancelled && Date.now() - startedAt > WATCH_TIMEOUT_MS) setWaitingFor(null);
    };

    const timer = setInterval(tick, WATCH_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (sub && sub.remove) sub.remove();
    };
  }, [waitingFor, bookingId]);

  return {
    waitingFor,
    startWatching: setWaitingFor,
    stopWatching: () => setWaitingFor(null),
    checkNow,
  };
}
