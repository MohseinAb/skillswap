// Push notification plumbing with no React Native or Firebase imports, so it can be tested in plain Node.
//
// How a notification travels (there is no server of our own):
//   1. Every phone saves its Expo push token on the signed-in user's document (users/{uid}.pushTokens).
//   2. When something happens (a chat message, an offer...), the phone that did it POSTs a message
//      straight to Expo's push service, addressed to the OTHER person's tokens.
//   3. Expo hands it to Google's FCM, which wakes the other phone, even if the app is closed.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_TOKENS_PER_USER = 10;

export const isExpoPushToken = (t) => typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t);

export const clip = (text, max = 140) => {
  const t = String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/*
  getTokens(uid)         -> Promise<string[]>  the user's saved push tokens
  removeToken(uid, tok)  -> Promise            drop a token Expo says is dead
*/
export async function sendPushToUser({ uid, message, getTokens, removeToken, fetchImpl = fetch }) {
  const tokens = ((await getTokens(uid)) || []).filter(isExpoPushToken).slice(0, MAX_TOKENS_PER_USER);
  if (tokens.length === 0) return { sent: 0, failed: 0, skipped: 'no-token' };

  const payload = tokens.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    data: message.data || {},
    channelId: message.channelId || 'default',
    sound: 'default',
    priority: 'high',
  }));

  const res = await fetchImpl(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = json && json.errors && json.errors[0] && json.errors[0].message;
    throw new Error(reason || `Expo push service responded with ${res.status}`);
  }

  // One ticket per token, in order. A dead token (app uninstalled, signed out elsewhere) is removed.
  const tickets = Array.isArray(json.data) ? json.data : [];
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const ticket = tickets[i];
    if (ticket && ticket.status === 'ok') {
      sent += 1;
    } else if (ticket && ticket.details && ticket.details.error === 'DeviceNotRegistered') {
      await removeToken(uid, tokens[i]);
    }
  }
  return { sent, failed: tokens.length - sent };
}

/* ───────────── what happens when someone taps a notification ───────────── */

// Only these screens can be opened from a notification, with only these params.
// (Anyone holding a push token could send a payload, so nothing arbitrary is ever navigated to.)
const ALLOWED_TARGETS = {
  Chat: { required: 'chatId', params: ['chatId', 'otherUserName'] },
  ClientBookingDetail: { required: 'bookingId', params: ['bookingId'] },
  BookingProgress: { required: 'bookingId', params: ['bookingId'] },
};

export function resolveNotificationTarget(data) {
  if (!data || typeof data.screen !== 'string') return null;
  const rule = ALLOWED_TARGETS[data.screen];
  if (!rule) return null;
  const raw = data.params && typeof data.params === 'object' ? data.params : {};
  if (typeof raw[rule.required] !== 'string' || !raw[rule.required]) return null;

  const params = {};
  rule.params.forEach((key) => {
    if (typeof raw[key] === 'string') params[key] = raw[key];
  });
  return { name: data.screen, params, toUid: typeof data.toUid === 'string' ? data.toUid : null };
}
