import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, styles } from '../styles';
import { peso } from '../services/paymentRules';

const TONES = {
  good: { fg: COLORS.primary, bg: COLORS.primaryDim, line: COLORS.primaryLine },
  warn: { fg: COLORS.warning, bg: COLORS.warningDim, line: COLORS.warningLine },
  muted: { fg: COLORS.textSecondary, bg: 'rgba(255, 255, 255, 0.06)', line: COLORS.border },
};

function Chip({ tone, label }) {
  const t = TONES[tone] || TONES.muted;
  return (
    <View style={[s.chip, { backgroundColor: t.bg, borderColor: t.line }]}>
      <Text style={[s.chipText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function Line({ label, amount, chip = null, strong = false, last = false }) {
  return (
    <View style={[s.line, last && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[s.label, strong && { color: COLORS.text }]}>{label}</Text>
        {chip ? (
          <View style={{ marginTop: 6 }}>
            <Chip tone={chip.tone} label={chip.label} />
          </View>
        ) : null}
      </View>
      <Text style={[s.amount, strong && s.amountStrong]}>{peso(amount)}</Text>
    </View>
  );
}

// Read-only breakdown of the agreed offer and how much of it has been paid.
// viewer: 'client' | 'freelancer' only changes the wording of the status chip.
export default function OfferSummary({ booking, viewer = 'client' }) {
  const o = booking && booking.offer;
  if (!o) return null;

  const accepted = booking.offerStatus === 'accepted';
  const downPaid = booking.payments && booking.payments.downpayment && booking.payments.downpayment.status === 'paid';
  const finalPaid = booking.payments && booking.payments.final && booking.payments.final.status === 'paid';

  const status = accepted
    ? { tone: 'good', label: 'Accepted' }
    : { tone: 'warn', label: viewer === 'client' ? 'Needs your review' : 'Waiting for client' };

  const downChip = downPaid
    ? { tone: 'good', label: 'Paid' }
    : accepted
    ? { tone: 'warn', label: 'Due now' }
    : { tone: 'muted', label: 'Due after acceptance' };

  const finalChip = finalPaid
    ? { tone: 'good', label: 'Paid' }
    : booking.deliveryStatus === 'submitted'
    ? { tone: 'warn', label: 'Due now' }
    : { tone: 'muted', label: 'Due on delivery' };

  return (
    <View style={[styles.infoCard, { marginBottom: 12 }]}>
      <View style={s.head}>
        <Text style={s.title}>Custom offer</Text>
        <Chip tone={status.tone} label={status.label} />
      </View>

      <Line label="Total price" amount={o.totalPrice} strong />
      {o.downpaymentRequired ? (
        <Line
          label={o.downpaymentType === 'percent' ? `Downpayment (${o.downpaymentValue}%)` : 'Downpayment'}
          amount={o.downpaymentAmount}
          chip={downChip}
        />
      ) : null}
      <Line
        label={o.downpaymentRequired ? 'Remaining balance' : 'Payment on delivery'}
        amount={o.remainingBalance}
        chip={finalChip}
        last
      />

      {o.note ? (
        <View style={s.note}>
          <Text style={s.noteLabel}>Scope and terms</Text>
          <Text style={s.noteText}>{o.note}</Text>
        </View>
      ) : null}

      <Text style={s.foot}>Paid so far: {peso(booking.amountPaid || 0)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  amount: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  amountStrong: { fontSize: 20, fontWeight: '800' },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '700' },
  note: { backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 12, marginTop: 14 },
  noteLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  noteText: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
  foot: { color: COLORS.textSecondary, fontSize: 12, marginTop: 14 },
});
