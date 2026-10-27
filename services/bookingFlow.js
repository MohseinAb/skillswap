import { auth, db } from '../firebaseConfig';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, query, where,
  writeBatch, runTransaction, arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import { describeOffer, peso } from './paymentRules';

/*
  Booking lifecycle (all fields live on the bookings/{id} document):

    status        pending ──(downpayment paid, or accepted with no downpayment)──> active ──(final paid)──> completed
    offerStatus   none ──(freelancer sends offer)──> sent ──(client accepts terms)──> accepted
    deliveryStatus none ──(freelancer submits link)──> submitted ──(final paid)──> unlocked

  The client app may write offerStatus/deliveryStatus up to "submitted". Everything that means
  "money arrived" (payments.*, amountPaid, deliveryStatus: unlocked, status: completed) is written
  only by the payments server after Xendit confirms the payment.
*/

const nameOf = (data, fallback) => (data && (data.fullName || data.name)) || fallback;

/* ───────────────────────── Chat helpers ───────────────────────── */

// A centred notice in the chat (offer sent, terms accepted, payment received...).
export async function sendChatSystemMessage(chatId, text) {
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    type: 'system',
    text,
    senderId: 'system',
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'chats', chatId), { lastMessage: text, updatedAt: serverTimestamp() });
}

async function noticeSafely(chatId, text) {
  if (!chatId) return;
  try {
    await sendChatSystemMessage(chatId, text);
  } catch (e) {
    console.warn('Could not post the chat notice:', e);
  }
}

// Every booking has its own chat. Bookings made before this update have no chatId, so
// find (or create) one and remember it on the booking.
export async function ensureBookingChat(booking) {
  if (booking.chatId) return booking.chatId;
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new Error('Please log in again.');

  const snap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', uid)));
  const exact = snap.docs.find((d) => d.data().bookingId === booking.id);
  // An older chat between the same two people that was never tied to a booking.
  const sharedLegacy = snap.docs.find((d) => {
    const c = d.data();
    return !c.bookingId && c.participants && c.participants.includes(booking.clientId) && c.participants.includes(booking.freelancerId);
  });

  let chatId = exact ? exact.id : sharedLegacy ? sharedLegacy.id : null;
  if (chatId) {
    if (!exact) await updateDoc(doc(db, 'chats', chatId), { bookingId: booking.id });
  } else {
    const created = await addDoc(collection(db, 'chats'), {
      participants: [booking.clientId, booking.freelancerId],
      clientId: booking.clientId,
      clientName: booking.clientName || 'Client',
      freelancerId: booking.freelancerId,
      freelancerName: booking.freelancerName || 'Freelancer',
      projectTitle: booking.serviceTitle || booking.projectTitle || 'Service booking',
      bookingId: booking.id,
      lastMessage: 'Chat opened for this booking.',
      updatedAt: serverTimestamp(),
    });
    chatId = created.id;
  }
  await updateDoc(doc(db, 'bookings', booking.id), { chatId });
  return chatId;
}

/* ───────────────────────── 1. Book now -> pending booking + chat ───────────────────────── */

// Used by both "Book" buttons (Search and Freelancer Portfolio).
export async function startNegotiation(service) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please log in to book a service.');

  const {
    serviceId = null,
    serviceTitle,
    category = 'General',
    price = 0,
    rateType = 'Hour',
    location = 'Iligan City',
    freelancerId,
    freelancerName = 'Freelancer',
  } = service;

  // Tapping Book twice should not create two bookings: reopen the one still being negotiated.
  const mine = await getDocs(query(collection(db, 'bookings'), where('clientId', '==', user.uid)));
  const open = mine.docs.find((d) => {
    const b = d.data();
    const sameService = (b.serviceId && b.serviceId === serviceId) || b.serviceTitle === serviceTitle;
    return b.freelancerId === freelancerId && sameService && (b.status || 'pending') === 'pending';
  });
  const existing = open ? { id: open.id, ...open.data() } : null;
  if (existing) {
    const chatId = await ensureBookingChat(existing);
    return { bookingId: existing.id, chatId, reused: true };
  }

  const clientSnap = await getDoc(doc(db, 'users', user.uid));
  const clientName = nameOf(clientSnap.exists() ? clientSnap.data() : null, (user.email || 'client').split('@')[0]);

  const bookingRef = doc(collection(db, 'bookings'));
  const chatRef = doc(collection(db, 'chats'));
  const intro = `Hi ${freelancerName}! I would like to book "${serviceTitle}". Can we agree on the scope, timeline and final price here?`;

  const batch = writeBatch(db);
  batch.set(bookingRef, {
    clientId: user.uid,
    clientName,
    freelancerId,
    freelancerName,
    serviceId,
    serviceTitle,
    projectTitle: serviceTitle,
    category,
    price: Number(price) || 0,
    listedPrice: Number(price) || 0,
    rateType,
    location,
    status: 'pending',
    progress: 0,
    offerStatus: 'none',
    deliveryStatus: 'none',
    amountPaid: 0,
    chatId: chatRef.id,
    latestNote: 'Booking request sent. Agree on the details in chat, then the freelancer sends a custom offer.',
    progressNotes: [],
    createdAt: serverTimestamp(),
  });
  batch.set(chatRef, {
    participants: [user.uid, freelancerId],
    clientId: user.uid,
    clientName,
    freelancerId,
    freelancerName,
    projectTitle: serviceTitle,
    bookingId: bookingRef.id,
    lastMessage: intro,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, 'chats', chatRef.id, 'messages')), {
    text: intro,
    senderId: user.uid,
    senderName: clientName,
    senderRole: 'CLIENT',
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  return { bookingId: bookingRef.id, chatId: chatRef.id, reused: false };
}

/* ───────────────────────── 2. Freelancer sends the final offer ───────────────────────── */

// `offer` is the object returned by computeOffer() (already validated).
export async function sendOffer(booking, offer, note, senderName) {
  const ref = doc(db, 'bookings', booking.id);

  const chatId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This booking no longer exists.');
    const b = snap.data();
    if ((b.status || 'pending') !== 'pending' || b.offerStatus === 'accepted') {
      throw new Error('The client already accepted an offer, so it can no longer be changed.');
    }
    tx.update(ref, {
      offer: {
        totalPrice: offer.total,
        downpaymentRequired: !!offer.downpaymentRequired,
        downpaymentType: offer.mode,
        downpaymentValue: offer.downpaymentRequired ? offer.value : 0,
        downpaymentAmount: offer.downpayment,
        remainingBalance: offer.remaining,
        note: (note || '').trim(),
        currency: 'PHP',
        sentAt: new Date().toISOString(),
      },
      offerVersion: (b.offerVersion || 0) + 1,
      offerStatus: 'sent',
      price: offer.total,
      latestNote: 'Custom offer sent. Waiting for the client to review and accept it.',
      updatedAt: serverTimestamp(),
    });
    return b.chatId || null;
  });

  let id = chatId;
  if (!id) {
    try { id = await ensureBookingChat(booking); } catch (e) { id = null; }
  }
  await noticeSafely(id, `${senderName || 'The freelancer'} sent a custom offer. ${describeOffer(offer)}`);
}

/* ───────────────────────── 3. Client accepts the terms ───────────────────────── */

export async function acceptOffer(booking, clientName) {
  const ref = doc(db, 'bookings', booking.id);
  const expectedVersion = booking.offerVersion || 0;

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const b = snap.exists() ? snap.data() : null;
    if (!b || b.offerStatus !== 'sent' || !b.offer) throw new Error('There is no open offer to accept.');
    if ((b.offerVersion || 0) !== expectedVersion) {
      throw new Error('The freelancer just changed the offer. Please review the latest terms.');
    }
    const needsDownpayment = !!b.offer.downpaymentRequired;
    const updates = {
      offerStatus: 'accepted',
      termsAcceptedAt: serverTimestamp(),
      latestNote: needsDownpayment
        ? 'Terms accepted. Waiting for the downpayment.'
        : 'Terms accepted. The project is now active.',
      updatedAt: serverTimestamp(),
    };
    // Without a downpayment there is nothing to wait for, so work can start right away.
    if (!needsDownpayment) {
      updates.status = 'active';
      updates.activatedAt = serverTimestamp();
    }
    tx.update(ref, updates);
    return { needsDownpayment, chatId: b.chatId || null, downpayment: b.offer.downpaymentAmount };
  });

  await noticeSafely(
    result.chatId,
    result.needsDownpayment
      ? `${clientName || 'The client'} accepted the offer. The project starts once the ${peso(result.downpayment)} downpayment is paid.`
      : `${clientName || 'The client'} accepted the offer. The project is now active.`
  );
  return result;
}

/* ───────────────────────── 4. Freelancer submits the final work ───────────────────────── */

// The link goes into a private sub-document, never onto the booking itself, so it can be
// protected with security rules until the client has paid (see firestore.rules.example).
export async function submitFinalWork(booking, urlInfo, note, senderName) {
  if ((booking.status || '') !== 'active') throw new Error('Final work can only be submitted on an active project.');
  if (booking.deliveryStatus === 'unlocked') throw new Error('This project was already delivered and paid.');

  const first = booking.deliveryStatus !== 'submitted';
  await setDoc(doc(db, 'bookings', booking.id, 'private', 'delivery'), {
    url: urlInfo.url,
    note: (note || '').trim(),
    freelancerId: booking.freelancerId,
    submittedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'bookings', booking.id), {
    deliveryStatus: 'submitted',
    deliveryHost: urlInfo.host,
    deliverySubmittedAt: serverTimestamp(),
    progress: 100,
    latestNote: 'Final work submitted. Pay the remaining balance to unlock it.',
    ...(first
      ? {
          progressNotes: arrayUnion({
            id: Date.now().toString(),
            progress: 100,
            note: (note || '').trim() || 'Final work submitted for review.',
            attachmentLink: null,
            attachmentImage: null,
            timestamp: new Date().toLocaleString(),
          }),
        }
      : {}),
    updatedAt: serverTimestamp(),
  });

  if (first) {
    await noticeSafely(
      booking.chatId,
      `${senderName || 'The freelancer'} submitted the final work. It unlocks after the remaining ${peso(booking.offer && booking.offer.remainingBalance)} is paid.`
    );
  }
}

export async function getDelivery(bookingId) {
  const snap = await getDoc(doc(db, 'bookings', bookingId, 'private', 'delivery'));
  return snap.exists() ? snap.data() : null;
}
