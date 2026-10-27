import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';
import { PAYMENT_CONFIG, computeOffer, peso } from '../services/paymentRules';
import { sendOffer } from '../services/bookingFlow';
import { notify } from '../services/notify';

const PERCENT_CHIPS = [30, 50, 70];

const asNumber = (v) => {
  const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function Row({ label, hint = null, value, strong = false, last = false }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={[s.rowLabel, strong && { color: COLORS.text }]}>{label}</Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={[s.rowValue, strong && { fontSize: 18, fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

// The freelancer's "final offer": total price, optional downpayment, and the remaining
// balance (always calculated, never typed, so the two parts cannot exceed the total).
export default function OfferModal({ visible, booking, senderName = '', onClose, onSent = null }) {
  const [total, setTotal] = useState('');
  const [needsDown, setNeedsDown] = useState(true);
  const [mode, setMode] = useState('percent');
  const [value, setValue] = useState(String(PAYMENT_CONFIG.DEFAULT_DOWNPAYMENT_PERCENT));
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  // Fill the form each time the modal opens (editing an existing offer keeps its values).
  useEffect(() => {
    if (!visible || !booking) return;
    const o = booking.offer;
    setTotal(String((o && o.totalPrice) || booking.price || ''));
    setNeedsDown(o ? !!o.downpaymentRequired : true);
    setMode((o && o.downpaymentType) || 'percent');
    setValue(String((o && o.downpaymentValue) || PAYMENT_CONFIG.DEFAULT_DOWNPAYMENT_PERCENT));
    setNote((o && o.note) || '');
  }, [visible, booking && booking.id]);

  const calc = useMemo(
    () => computeOffer({ total, downpaymentRequired: needsDown, mode, value }),
    [total, needsDown, mode, value]
  );

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    if (next === 'flat') {
      const t = asNumber(total);
      setValue(t > 0 ? String(Math.round(t * (PAYMENT_CONFIG.DEFAULT_DOWNPAYMENT_PERCENT / 100))) : '');
    } else {
      setValue(String(PAYMENT_CONFIG.DEFAULT_DOWNPAYMENT_PERCENT));
    }
  };

  const money = (n) => (typeof n === 'number' ? peso(n) : '-');

  const handleSend = async () => {
    if (!calc.ok) {
      notify('Check the offer', calc.error);
      return;
    }
    setSending(true);
    try {
      await sendOffer(booking, calc, note, senderName);
      if (onSent) onSent(calc);
      onClose();
    } catch (e) {
      notify('Could not send the offer', e.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.title}>{booking && booking.offer ? 'Update custom offer' : 'Create custom offer'}</Text>
              <Text style={s.subtitle} numberOfLines={1}>
                {(booking && booking.clientName) || 'Client'}, {(booking && (booking.serviceTitle || booking.projectTitle)) || 'booking'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Final total price</Text>
            <View style={s.inputRow}>
              <Text style={s.prefix}>₱</Text>
              <TextInput
                style={s.input}
                value={total}
                onChangeText={setTotal}
                keyboardType="numeric"
                placeholder="5000"
                placeholderTextColor={COLORS.placeholder}
              />
            </View>

            <View style={s.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.toggleTitle}>Ask for a downpayment</Text>
                <Text style={s.toggleHint}>The client pays part of the price before you start working.</Text>
              </View>
              <Switch
                value={needsDown}
                onValueChange={setNeedsDown}
                trackColor={{ false: COLORS.inputBorder, true: COLORS.primaryLine }}
                thumbColor={needsDown ? COLORS.primary : COLORS.textSecondary}
              />
            </View>

            {needsDown ? (
              <>
                <View style={s.segment}>
                  {[
                    { key: 'percent', label: 'Percentage' },
                    { key: 'flat', label: 'Fixed amount' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => switchMode(opt.key)}
                      style={[s.segmentBtn, mode === opt.key && s.segmentBtnActive]}
                    >
                      <Text style={[s.segmentText, mode === opt.key && { color: COLORS.primary }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {mode === 'percent' ? (
                  <View style={s.chips}>
                    {PERCENT_CHIPS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setValue(String(p))}
                        style={[s.chip, String(value) === String(p) && s.chipActive]}
                      >
                        <Text style={[s.chipText, String(value) === String(p) && { color: COLORS.primary }]}>{p}%</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <Text style={styles.label}>{mode === 'percent' ? 'Downpayment percentage' : 'Downpayment amount'}</Text>
                <View style={s.inputRow}>
                  <Text style={s.prefix}>{mode === 'percent' ? '%' : '₱'}</Text>
                  <TextInput
                    style={s.input}
                    value={value}
                    onChangeText={setValue}
                    keyboardType="numeric"
                    placeholder={mode === 'percent' ? '50' : '2500'}
                    placeholderTextColor={COLORS.placeholder}
                  />
                </View>
              </>
            ) : null}

            <View style={s.breakdown}>
              <Row label="Total price" value={money(calc.total)} strong />
              {needsDown ? (
                <Row label="Downpayment" hint="Due when the client accepts the offer" value={money(calc.downpayment)} />
              ) : null}
              <Row
                label={needsDown ? 'Remaining balance' : 'Payment on delivery'}
                hint={needsDown ? 'Calculated for you. Due when you submit the final work' : 'Due when you submit the final work'}
                value={money(calc.remaining)}
                last
              />
            </View>

            {!calc.ok && calc.error ? <Text style={s.error}>{calc.error}</Text> : null}

            <Text style={styles.label}>Scope and terms (optional)</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top', marginBottom: 14 }]}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="What is included, the timeline, how many revisions..."
              placeholderTextColor={COLORS.placeholder}
            />

            <TouchableOpacity
              style={[styles.primaryButton, (!calc.ok || sending) && { opacity: 0.55 }]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color={COLORS.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>{booking && booking.offer ? 'Update offer' : 'Send offer to client'}</Text>
              )}
            </TouchableOpacity>

            <Text style={s.fine}>
              Your final work stays locked until the client pays the remaining balance. The client can accept or discuss the offer in chat.
            </Text>
            <View style={{ height: 12 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.78)', justifyContent: 'flex-end', alignItems: 'center' },
  // Opaque on purpose: glass surfaces let the page behind show through.
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: COLORS.cardInactiveBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    padding: 20,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  title: { color: COLORS.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 3 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.inputBorder,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  prefix: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700', marginRight: 10 },
  input: { flex: 1, color: COLORS.text, fontSize: 17, fontWeight: '600', paddingVertical: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  toggleTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  toggleHint: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  segmentBtnActive: { backgroundColor: COLORS.primaryDim, borderColor: COLORS.primaryLine },
  segmentText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', marginBottom: 12 },
  chip: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: COLORS.surfaceRaised,
  },
  chipActive: { backgroundColor: COLORS.primaryDim, borderColor: COLORS.primaryLine },
  chipText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  breakdown: {
    backgroundColor: COLORS.inputBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  rowHint: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, opacity: 0.85 },
  rowValue: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  error: { color: COLORS.warning, fontSize: 13, lineHeight: 18, marginBottom: 12, marginTop: 4 },
  fine: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
});
