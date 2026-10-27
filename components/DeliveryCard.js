import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';
import { peso } from '../services/paymentRules';
import { getDelivery } from '../services/bookingFlow';
import PayButton from './PayButton';

// What the client sees once the freelancer has submitted the final work.
// Locked: the link is hidden and the remaining balance unlocks it.
// Unlocked: the link is fetched from the booking's private sub-document and shown.
export default function DeliveryCard({
  booking,
  canPay = true,
  blockedMessage = 'Payments are paused while a dispute is open.',
  payBusy = false,
  waiting = false,
  onPayFinal = null,
  onCheck = null,
}) {
  const unlocked = booking.deliveryStatus === 'unlocked';
  const [delivery, setDelivery] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!unlocked) {
      setDelivery(null);
      setError('');
      return undefined;
    }
    let alive = true;
    getDelivery(booking.id)
      .then((d) => {
        if (!alive) return;
        setDelivery(d);
        if (!d) setError('The link is not available yet. Reopen this screen in a moment.');
      })
      .catch(() => {
        if (alive) setError('Could not load the link. Check your connection and reopen this screen.');
      });
    return () => {
      alive = false;
    };
  }, [unlocked, booking.id]);

  const freelancer = booking.freelancerName || 'The freelancer';

  if (unlocked) {
    return (
      <View style={[styles.infoCard, s.unlockedCard]}>
        <View style={s.head}>
          <View style={[s.iconWrap, { backgroundColor: COLORS.primary }]}>
            <Feather name="unlock" size={16} color={COLORS.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Delivered and paid</Text>
            <Text style={s.sub}>{freelancer} sent you the final work.</Text>
          </View>
        </View>

        {delivery ? (
          <>
            <TouchableOpacity style={s.linkRow} onPress={() => Linking.openURL(delivery.url).catch(() => {})} activeOpacity={0.8}>
              <Feather name="external-link" size={16} color={COLORS.primary} style={{ marginRight: 10 }} />
              <Text style={s.linkText} numberOfLines={2}>{delivery.url}</Text>
            </TouchableOpacity>
            {delivery.note ? (
              <View style={s.note}>
                <Text style={s.noteLabel}>Note from {freelancer}</Text>
                <Text style={s.noteText}>{delivery.note}</Text>
              </View>
            ) : null}
          </>
        ) : error ? (
          <Text style={s.error}>{error}</Text>
        ) : (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 14 }} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.infoCard, s.lockedCard]}>
      <View style={s.head}>
        <View style={[s.iconWrap, { backgroundColor: COLORS.primaryDim, borderWidth: 1, borderColor: COLORS.primaryLine }]}>
          <Feather name="lock" size={16} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Final work is ready</Text>
          <Text style={s.sub}>
            {freelancer} submitted a link{booking.deliveryHost ? ` on ${booking.deliveryHost}` : ''}. It unlocks as soon as the remaining balance is paid.
          </Text>
        </View>
      </View>

      {/* Placeholder bars stand in for the hidden link */}
      <View style={s.hidden}>
        <View style={{ flex: 1 }}>
          <View style={[s.bar, { width: '82%' }]} />
          <View style={[s.bar, { width: '58%', marginTop: 8 }]} />
        </View>
        <Feather name="lock" size={18} color={COLORS.textSecondary} />
      </View>

      {canPay ? (
        <PayButton
          title={`Pay ${peso(booking.offer && booking.offer.remainingBalance)} to unlock the work`}
          busy={payBusy}
          waiting={waiting}
          onPress={onPayFinal}
          onCheck={onCheck}
        />
      ) : (
        <Text style={s.sub}>{blockedMessage}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  lockedCard: { borderColor: COLORS.primaryLine, marginBottom: 14 },
  unlockedCard: { borderColor: COLORS.primaryLine, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  sub: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  hidden: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  bar: { height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceRaised },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDim,
    borderColor: COLORS.primaryLine,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  linkText: { flex: 1, color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  note: { backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 12, marginTop: 12 },
  noteLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  noteText: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
  error: { color: COLORS.warning, fontSize: 13, marginTop: 4 },
});
