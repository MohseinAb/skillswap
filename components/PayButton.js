import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS, styles } from '../styles';
import { PAYMENT_CONFIG } from '../services/paymentRules';

// The primary "pay" action. While the client is paying in the checkout tab it turns into a
// quiet waiting card, so they are never left wondering whether the tap did anything.
export default function PayButton({ title, busy, waiting, onPress, onCheck }) {
  if (waiting) {
    return (
      <View style={s.waiting}>
        <ActivityIndicator color={COLORS.primary} />
        <View style={s.waitingBody}>
          <Text style={s.waitingTitle}>Waiting for your payment to be confirmed</Text>
          <Text style={s.waitingHint}>Finish paying in the checkout tab. This screen updates by itself.</Text>
          <View style={s.links}>
            <TouchableOpacity onPress={onCheck}>
              <Text style={s.link}>Check status</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPress}>
              <Text style={[s.link, { marginLeft: 20 }]}>Reopen checkout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 4 }, busy && { opacity: 0.7 }]}
        onPress={onPress}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? <ActivityIndicator color={COLORS.onPrimary} /> : <Text style={styles.primaryButtonText}>{title}</Text>}
      </TouchableOpacity>
      <Text style={s.fine}>
        {PAYMENT_CONFIG.TEST_MODE ? 'Secure checkout by Xendit. Test mode, so no real money moves.' : 'Secure checkout by Xendit.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  fine: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 10 },
  waiting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryDim,
    borderColor: COLORS.primaryLine,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  waitingBody: { flex: 1, marginLeft: 14 },
  waitingTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  waitingHint: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  links: { flexDirection: 'row', marginTop: 10 },
  link: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
});
