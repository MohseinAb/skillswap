import { peso } from './paymentRules';
import { clip } from './pushCore';

// Every notification the app sends, in one place. Each builder returns
//   { title, body, channelId, data }
// where `data.screen` + `data.params` say what opens when the notification is tapped
// (validated again on the receiving phone, see resolveNotificationTarget).
//
// Android channels: 'messages' for chat, 'updates' for everything else, so people can mute one without the other.

// A booking opens on a different screen depending on who receives the notification.
const bookingTarget = (role, bookingId) => ({
  screen: role === 'freelancer' ? 'BookingProgress' : 'ClientBookingDetail', // admins use the client view
  params: { bookingId },
});

const quoted = (t) => `"${clip(t || 'your booking', 60)}"`;

export const messages = {
  chat: ({ senderName, text, chatId }) => ({
    title: clip(senderName || 'New message', 60),
    body: clip(text, 140),
    channelId: 'messages',
    data: { type: 'chat', screen: 'Chat', params: { chatId, otherUserName: senderName || 'User' } },
  }),

  bookingRequested: ({ clientName, serviceTitle, chatId }) => ({
    title: 'New booking request',
    body: `${clip(clientName || 'A client', 40)} wants to book ${quoted(serviceTitle)}. Open the chat to agree on details and send an offer.`,
    channelId: 'updates',
    data: { type: 'booking_request', screen: 'Chat', params: { chatId, otherUserName: clientName || 'Client' } },
  }),

  // total / downpayment / requiresDownpayment come from the freelancer's offer
  offerSent: ({ freelancerName, serviceTitle, total, downpayment, requiresDownpayment, bookingId }) => ({
    title: `New offer from ${clip(freelancerName || 'your freelancer', 40)}`,
    body: requiresDownpayment
      ? `${quoted(serviceTitle)}: ${peso(total)} total, ${peso(downpayment)} downpayment. Review and accept the terms.`
      : `${quoted(serviceTitle)}: ${peso(total)}, paid on delivery. Review and accept the terms.`,
    channelId: 'updates',
    data: { type: 'offer', ...bookingTarget('client', bookingId) },
  }),

  offerAccepted: ({ clientName, serviceTitle, requiresDownpayment, downpayment, bookingId }) => ({
    title: 'Offer accepted',
    body: requiresDownpayment
      ? `${clip(clientName || 'The client', 40)} accepted your offer for ${quoted(serviceTitle)}. Work starts once the ${peso(downpayment)} downpayment is paid.`
      : `${clip(clientName || 'The client', 40)} accepted your offer for ${quoted(serviceTitle)}. The project is now active.`,
    channelId: 'updates',
    data: { type: 'offer_accepted', ...bookingTarget('freelancer', bookingId) },
  }),

  // type: 'downpayment' | 'final', sent to the freelancer
  paymentReceived: ({ clientName, serviceTitle, type, amount, bookingId }) => ({
    title: type === 'downpayment' ? 'Downpayment received' : 'Final payment received',
    body:
      type === 'downpayment'
        ? `${clip(clientName || 'The client', 40)} paid ${peso(amount)} for ${quoted(serviceTitle)}. You can start working.`
        : `${clip(clientName || 'The client', 40)} paid ${peso(amount)} for ${quoted(serviceTitle)}. The project is complete and counts toward your earnings.`,
    channelId: 'updates',
    data: { type: 'payment', ...bookingTarget('freelancer', bookingId) },
  }),

  finalWorkSubmitted: ({ freelancerName, serviceTitle, remaining, bookingId }) => ({
    title: 'Your final work is ready',
    body: `${clip(freelancerName || 'Your freelancer', 40)} submitted ${quoted(serviceTitle)}. Pay the remaining ${peso(remaining)} to unlock it.`,
    channelId: 'updates',
    data: { type: 'final_work', ...bookingTarget('client', bookingId) },
  }),

  progressUpdate: ({ freelancerName, serviceTitle, progress, note, bookingId }) => ({
    title: `Progress update: ${progress}%`,
    body: note
      ? `${clip(freelancerName || 'Your freelancer', 40)} on ${quoted(serviceTitle)}: ${clip(note, 110)}`
      : `${clip(freelancerName || 'Your freelancer', 40)} updated ${quoted(serviceTitle)} to ${progress}%.`,
    channelId: 'updates',
    data: { type: 'progress', ...bookingTarget('client', bookingId) },
  }),

  bookingDeclined: ({ freelancerName, serviceTitle, bookingId }) => ({
    title: 'Booking declined',
    body: `${clip(freelancerName || 'The freelancer', 40)} declined your request for ${quoted(serviceTitle)}.`,
    channelId: 'updates',
    data: { type: 'declined', ...bookingTarget('client', bookingId) },
  }),

  reviewReceived: ({ clientName, rating, serviceTitle, bookingId }) => ({
    title: `New ${rating}-star review`,
    body: `${clip(clientName || 'A client', 40)} reviewed ${quoted(serviceTitle)}.`,
    channelId: 'updates',
    data: { type: 'review', ...bookingTarget('freelancer', bookingId) },
  }),

  // forRole: 'client' | 'freelancer' | 'admin' (the person receiving it)
  disputeOpened: ({ clientName, serviceTitle, bookingId, forRole }) => ({
    title: 'Dispute opened',
    body: `${clip(clientName || 'The client', 40)} opened a dispute on ${quoted(serviceTitle)}. ${forRole === 'admin' ? 'Join the chat to review it.' : 'An admin will join the chat.'}`,
    channelId: 'updates',
    data: { type: 'dispute', ...bookingTarget(forRole, bookingId) },
  }),

  disputeMessage: ({ senderName, senderRole, text, bookingId, forRole }) => ({
    title: `${clip(senderName || 'Someone', 40)}${senderRole === 'ADMIN' ? ' (Admin)' : ''} in the dispute chat`,
    body: clip(text, 140),
    channelId: 'messages',
    data: { type: 'dispute_message', ...bookingTarget(forRole, bookingId) },
  }),

  disputeResolved: ({ outcome, serviceTitle, bookingId, forRole }) => ({
    title: 'Dispute resolved',
    body: `An admin marked ${quoted(serviceTitle)} as ${outcome}.`,
    channelId: 'updates',
    data: { type: 'dispute_resolved', ...bookingTarget(forRole, bookingId) },
  }),
};
