import React, { useState, useEffect } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Image, Linking, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, styles } from '../styles';
import OfferModal from '../components/OfferModal';
import OfferSummary from '../components/OfferSummary';
import { notify, confirmAction } from '../services/notify';
import {
  isNegotiated, getBookingStage, stageLabel, normalizeUrl, peso, payoutSummary, PAYMENT_CONFIG,
} from '../services/paymentRules';
import { ensureBookingChat, submitFinalWork, getDelivery } from '../services/bookingFlow';
import { notifyUsers, notifyDisputeParticipants } from '../services/notifications';
import { messages as pushMessages } from '../services/pushMessages';

import { auth, db } from '../firebaseConfig';
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

const MILESTONES = [0, 20, 40, 60, 80, 100];

export default function BookingProgressScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [attachmentLink, setAttachmentLink] = useState('');
  const [attachmentImage, setAttachmentImage] = useState(null);
  const [saving, setSaving] = useState(false);

  // 3-Way Dispute Group Chat State
  const [groupMessage, setGroupMessage] = useState('');
  const [sendingGroupMsg, setSendingGroupMsg] = useState(false);

  // Fullscreen Image Viewer State
  const [previewImageUri, setPreviewImageUri] = useState(null);

  // Offer & final delivery
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [finalUrl, setFinalUrl] = useState('');
  const [finalNote, setFinalNote] = useState('');
  const [submittingFinal, setSubmittingFinal] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) setCurrentUserData(snap.data());
      });
    }

    const unsub = onSnapshot(doc(db, 'bookings', bookingId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setBooking(data);
        setProgress(data.progress || 0);
      }
    });
    return () => unsub();
  }, [bookingId]);

  // Live profile, so a payout method saved in Profile is picked up when you come back here.
  useEffect(() => {
    if (!auth.currentUser) return undefined;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setCurrentUserData(snap.data());
    });
  }, []);

  // Once the final link is submitted, show it again in the form so it can be replaced.
  useEffect(() => {
    if (booking?.deliveryStatus === 'submitted' && !finalUrl) {
      getDelivery(bookingId).then((d) => { if (d?.url) setFinalUrl(d.url); }).catch(() => {});
    }
  }, [booking?.deliveryStatus]);

  const isAdmin = 
    (currentUserData?.role || currentUserData?.accountType || '').toLowerCase() === 'admin' ||
    auth.currentUser?.email?.toLowerCase() === 'admin@skillswap.ph';

  const negotiated = isNegotiated(booking);
  const stage = getBookingStage(booking);

  const handlePickProgressPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setAttachmentImage(uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not select image.');
    }
  };

  const handleSaveUpdate = async (markCompleted = false) => {
    const finalProgress = markCompleted ? 100 : progress;
    // Negotiated bookings are completed by the client's final payment, never by the freelancer.
    const finalStatus = negotiated
      ? booking.status || 'active'
      : markCompleted || finalProgress === 100
      ? 'completed'
      : booking.status === 'disputed'
      ? 'disputed'
      : 'active';
    const noteText = note.trim() || (markCompleted ? 'Project completed!' : `Updated progress to ${finalProgress}%`);

    setSaving(true);
    try {
      const newNoteEntry = {
        id: Date.now().toString(),
        progress: finalProgress,
        note: isAdmin ? `[ADMIN] ${noteText}` : noteText,
        attachmentLink: attachmentLink.trim() || null,
        attachmentImage: attachmentImage || null,
        timestamp: new Date().toLocaleString()
      };

      await updateDoc(doc(db, 'bookings', bookingId), {
        progress: finalProgress,
        status: finalStatus,
        latestNote: noteText,
        progressNotes: arrayUnion(newNoteEntry),
        updatedAt: serverTimestamp()
      });

      // Push: tell the client about the update (and the freelancer too if an admin posted it).
      notifyUsers(
        [booking.clientId, booking.freelancerId],
        pushMessages.progressUpdate({
          freelancerName: booking.freelancerName,
          serviceTitle: booking.serviceTitle || booking.projectTitle,
          progress: finalProgress,
          note: note.trim(),
          bookingId,
        })
      );

      setNote('');
      setAttachmentLink('');
      setAttachmentImage(null);

      notify(finalStatus === 'completed' ? 'Project completed!' : 'Progress updated', `Updated to ${finalProgress}%.`);
    } catch (error) {
      notify('Error', 'Failed to update progress.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = async () => {
    try {
      const chatId = await ensureBookingChat(booking);
      navigation.navigate('Chat', { chatId, otherUserName: booking.clientName || 'Client' });
    } catch (error) {
      notify('Could not open the chat', 'Please try again in a moment.');
    }
  };

  const handleOpenOffer = () => {
    if (PAYMENT_CONFIG.REQUIRE_PAYOUT_METHOD && !payoutSummary(currentUserData?.paymentMethod)) {
      notify(
        'Set up your payout method first',
        'Add a GCash, Maya or bank account under Profile, then Payout Method, so SkillSwap knows where to send your earnings.'
      );
      navigation.navigate('FreelancerTabs', { screen: 'Profile' });
      return;
    }
    setOfferModalVisible(true);
  };

  const handleSubmitFinal = async () => {
    const link = normalizeUrl(finalUrl);
    if (!link.ok) {
      notify('Check the link', link.error);
      return;
    }
    const replacing = booking.deliveryStatus === 'submitted';
    if (!replacing) {
      const ok = await confirmAction(
        'Submit your final work?',
        `This sets progress to 100%. ${booking.clientName || 'The client'} will see that your work is ready, but the link stays locked until they pay the remaining ${peso(booking.offer?.remainingBalance)}.`,
        'Submit final work'
      );
      if (!ok) return;
    }
    setSubmittingFinal(true);
    try {
      await submitFinalWork(booking, link, finalNote, currentUserData?.fullName || currentUserData?.name);
      setFinalNote('');
      notify(
        replacing ? 'Link updated' : 'Final work submitted',
        `The link stays hidden until the client pays the remaining ${peso(booking.offer?.remainingBalance)}.`
      );
    } catch (error) {
      notify('Could not submit the final work', error.message || 'Please try again.');
    } finally {
      setSubmittingFinal(false);
    }
  };

  const handleSendDisputeGroupMessage = async () => {
    if (!groupMessage.trim() || !auth.currentUser) return;
    setSendingGroupMsg(true);
    try {
      const roleLabel = isAdmin 
        ? 'ADMIN' 
        : auth.currentUser.uid === booking.freelancerId 
        ? 'FREELANCER' 
        : 'CLIENT';

      const baseName = (currentUserData?.fullName || currentUserData?.name || auth.currentUser.email?.split('@')[0] || 'User')
        .replace(/\s*\[ADMIN\]/gi, '');

      const msgObj = {
        id: Date.now().toString(),
        senderId: auth.currentUser.uid,
        senderName: baseName, // No duplicate [ADMIN] here!
        senderRole: roleLabel,
        text: groupMessage.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      await updateDoc(doc(db, 'bookings', bookingId), {
        disputeMessages: arrayUnion(msgObj),
        updatedAt: serverTimestamp()
      });

      // Push: tell the other people in the dispute chat.
      notifyDisputeParticipants(booking, (forRole) =>
        pushMessages.disputeMessage({ senderName: baseName, senderRole: roleLabel, text: msgObj.text, bookingId, forRole })
      );

      setGroupMessage('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSendingGroupMsg(false);
    }
  };

  if (!booking) {
    return (
      <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </LinearGradient>
    );
  }

  // Negotiated bookings only show progress controls while the project is active (offer accepted, downpayment paid)
  // and before the final work is submitted. After that, the Final delivery section takes over.
  const showControls =
    !negotiated ||
    (['active', 'accepted', 'disputed'].includes((booking.status || '').toLowerCase()) && stage !== 'delivered_locked');
  const milestones = negotiated ? MILESTONES.filter((v) => v < 100) : MILESTONES;
  const isDisputed = (booking.status || '').toLowerCase() === 'disputed' || booking.disputeStatus === 'open' || (booking.disputeMessages && booking.disputeMessages.length > 0);

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        
        <View style={[styles.chatHeaderBg, { paddingVertical: 16, marginBottom: 15 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
            <Feather name="chevron-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }}>
            {isAdmin ? 'Admin Progress & Dispute Room' : 'Update Project Progress'}
          </Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
          
          {/* Project Summary Card */}
          <View style={[styles.bookingCard, isDisputed && { borderColor: '#FF4C4C' }]}>
            <View style={styles.bookingTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingTitle}>{booking.serviceTitle || booking.projectTitle || 'Service Project'}</Text>
                <Text style={styles.bookingDetails}>Client: {booking.clientName || 'Client'}</Text>
                <Text style={styles.bookingDetails}>Freelancer: {booking.freelancerName || 'Freelancer'}</Text>
                <Text style={[styles.bookingDetails, { color: COLORS.primary, fontWeight: 'bold', marginTop: 4 }]}>
                  Rate: ₱ {booking.price || 0}
                </Text>
              </View>
              <View style={[styles.statusPill, { borderColor: isDisputed ? '#FF4C4C' : COLORS.primary }]}>
                <Text style={[styles.statusText, { color: isDisputed ? '#FF4C4C' : COLORS.primary }]}>
                  {negotiated ? stageLabel(stage, 'freelancer').toUpperCase() : (booking.status || 'ACTIVE').toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={[styles.progressRow, { marginTop: 10 }]}>
              <View style={[styles.progressBarBg, { height: 8, borderRadius: 4 }]}>
                <View style={[styles.progressBarFill, { width: `${progress}%`, height: 8, borderRadius: 4 }]} />
              </View>
              <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>{progress}%</Text>
            </View>
          </View>

          {/* ============================================================== */}
          {/* OFFER & PAYMENT (bookings made with the new flow)               */}
          {/* ============================================================== */}
          {negotiated && (
            <>
              <Text style={styles.sectionTitle}>OFFER & PAYMENT</Text>

              {booking.offer ? (
                <OfferSummary booking={booking} viewer="freelancer" />
              ) : (
                <View style={[styles.infoCard, { marginBottom: 12 }]}>
                  <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>No offer sent yet</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 }}>
                    Agree on the scope and price with {booking.clientName || 'the client'} in chat, then send a custom offer
                    with the final price and an optional downpayment.
                  </Text>
                </View>
              )}

              {!isAdmin && (stage === 'negotiating' || stage === 'offer_sent') && (
                <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                  <TouchableOpacity style={[styles.btnHalf, styles.btnDark]} onPress={handleOpenChat}>
                    <Text style={styles.btnDarkText}>Open chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnHalf, styles.btnPrimary]} onPress={handleOpenOffer}>
                    <Text style={styles.btnPrimaryText}>{booking.offer ? 'Edit offer' : 'Create custom offer'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {stage === 'awaiting_downpayment' && (
                <View style={[styles.infoCard, { marginBottom: 14 }]}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 }}>
                    The client accepted your offer. Work starts as soon as they pay the {peso(booking.offer?.downpaymentAmount)} downpayment,
                    and you will see it in the chat.
                  </Text>
                </View>
              )}
            </>
          )}

          {/* ============================================================== */}
          {/* 3-WAY DISPUTE GROUP CHAT (CLIENT + FREELANCER + ADMIN)         */}
          {/* ============================================================== */}
          {isDisputed && (
            <View style={[styles.infoCard, { borderColor: '#FF4C4C', marginBottom: 20, backgroundColor: '#121A16' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="users" size={16} color="#FF4C4C" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FF4C4C', fontWeight: 'bold', fontSize: 13 }}>
                    3-WAY DISPUTE GROUP CHAT
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,76,76,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: '#FF4C4C', fontSize: 9, fontWeight: 'bold' }}>CLIENT • FREELANCER • ADMIN</Text>
                </View>
              </View>

              {booking.disputeReason && (
                <View style={{ backgroundColor: 'rgba(255, 76, 76, 0.1)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ color: '#F4C77F', fontSize: 11, fontWeight: 'bold' }}>
                    Client Dispute Reason: "{booking.disputeReason}"
                  </Text>
                  {booking.adminResolution && (
                    <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>
                      ✓ Admin Decision: {booking.adminResolution}
                    </Text>
                  )}
                </View>
              )}

              <View style={{ maxHeight: 280, marginBottom: 12 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {(booking.disputeMessages || []).map((msg, i) => {
                    const isMine = msg.senderId === auth.currentUser?.uid;
                    const isMsgAdmin = msg.senderRole === 'ADMIN';
                    return (
                      <View
                        key={msg.id || i}
                        style={{
                          alignSelf: isMine ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          backgroundColor: isMsgAdmin
                            ? 'rgba(132, 220, 198, 0.2)'
                            : isMine
                            ? COLORS.primary
                            : COLORS.inputBg,
                          borderWidth: 1,
                          borderColor: isMsgAdmin ? COLORS.primary : COLORS.inputBorder,
                          borderRadius: 12,
                          padding: 10,
                          marginBottom: 8
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: 'bold',
                            color: isMsgAdmin ? COLORS.primary : isMine ? '#000' : '#F4C77F'
                          }}>
                            {msg.senderName} ({msg.senderRole})
                          </Text>
                          <Text style={{
                            fontSize: 9,
                            marginLeft: 6,
                            color: isMine && !isMsgAdmin ? '#222' : COLORS.textSecondary
                          }}>
                            {msg.timestamp}
                          </Text>
                        </View>
                        <Text style={{ color: isMine && !isMsgAdmin ? '#000' : COLORS.text, fontSize: 12 }}>
                          {msg.text}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 10, marginRight: 8 }]}
                  placeholder={isAdmin ? "Reply as [ADMIN] to Client & Freelancer..." : "Reply to Client & Admin..."}
                  placeholderTextColor={COLORS.textSecondary}
                  value={groupMessage}
                  onChangeText={setGroupMessage}
                />
                <TouchableOpacity
                  style={{ backgroundColor: COLORS.primary, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' }}
                  onPress={handleSendDisputeGroupMessage}
                  disabled={sendingGroupMsg}
                >
                  <Feather name="send" size={16} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showControls && (
          <>
          {/* Select Progress Percentage */}
          <Text style={styles.sectionTitle}>SET PROGRESS PERCENTAGE</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            {milestones.map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => setProgress(val)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: progress === val ? COLORS.primary : COLORS.inputBorder,
                  backgroundColor: progress === val ? COLORS.primary : COLORS.cardInactiveBg
                }}
              >
                <Text style={{ color: progress === val ? '#000' : COLORS.text, fontWeight: 'bold', fontSize: 12 }}>
                  {val}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Progress Note Input */}
          <Text style={styles.sectionTitle}>PROGRESS NOTE FOR CLIENT</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: 'top', marginBottom: 15 }]}
            placeholder="Write an update on what you've accomplished or next steps..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            value={note}
            onChangeText={setNote}
          />

          {/* Attach Google Drive / Deliverable Link */}
          <Text style={styles.sectionTitle}>ATTACH LINK (GOOGLE DRIVE, FIGMA, GITHUB)</Text>
          <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginBottom: 15 }]}>
            <Feather name="link" size={16} color={COLORS.primary} style={{ marginRight: 10 }} />
            <TextInput
              style={{ flex: 1, color: COLORS.text, fontSize: 13, paddingVertical: 12 }}
              placeholder="https://drive.google.com/..."
              placeholderTextColor={COLORS.textSecondary}
              value={attachmentLink}
              onChangeText={setAttachmentLink}
              autoCapitalize="none"
            />
            {attachmentLink.length > 0 && (
              <TouchableOpacity onPress={() => setAttachmentLink('')}>
                <Feather name="x" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Upload Progress Photo */}
          <Text style={styles.sectionTitle}>UPLOAD PROGRESS PHOTO / SCREENSHOT</Text>
          <View style={[styles.uploadBox, { padding: 18, marginBottom: 15 }]}>
            {attachmentImage ? (
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPreviewImageUri(attachmentImage)}
                  style={{ width: 110, height: 110, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.primary, marginBottom: 10 }}
                >
                  <Image source={{ uri: attachmentImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity onPress={handlePickProgressPhoto} style={{ marginRight: 15 }}>
                    <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: 'bold' }}>Change Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setAttachmentImage(null)}>
                    <Text style={{ color: '#FF4C4C', fontSize: 12, fontWeight: 'bold' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickProgressPhoto} style={{ alignItems: 'center' }}>
                <Feather name="camera" size={22} color={COLORS.primary} style={{ marginBottom: 8 }} />
                <Text style={styles.uploadText}>Tap to upload a progress photo or screenshot</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleSaveUpdate(false)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Progress & Attachments</Text>
            )}
          </TouchableOpacity>

          {!negotiated && booking.status !== 'completed' && (
            <TouchableOpacity
              style={[styles.logoutBtn, { borderColor: COLORS.primary, marginTop: 12 }]}
              onPress={() => handleSaveUpdate(true)}
              disabled={saving}
            >
              <Feather name="check-circle" size={18} color={COLORS.primary} />
              <Text style={[styles.logoutText, { color: COLORS.primary }]}>Mark Project as Completed (100%)</Text>
            </TouchableOpacity>
          )}

          </>
          )}

          {/* Final delivery: the link stays locked until the client pays the remaining balance */}
          {negotiated && !isAdmin && ['in_progress', 'delivered_locked', 'completed'].includes(stage) && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 25 }]}>FINAL DELIVERY</Text>
              {stage === 'completed' ? (
                <View style={[styles.infoCard, { borderColor: COLORS.primaryLine }]}>
                  <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>Delivered and paid</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 }}>
                    The client paid in full, and {peso(booking.amountPaid)} counts toward your earnings.
                  </Text>
                </View>
              ) : (
                <View style={styles.infoCard}>
                  <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>
                    {stage === 'delivered_locked' ? 'Waiting for the client to pay' : 'Submit your final work'}
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
                    {stage === 'delivered_locked'
                      ? `Your link is saved and hidden. The client unlocks it by paying ${peso(booking.offer?.remainingBalance)}. You can replace the link until then.`
                      : `Paste a link to your finished work (Google Drive, Figma, GitHub...). The client only sees it after paying the remaining ${peso(booking.offer?.remainingBalance)}.`}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://drive.google.com/..."
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={finalUrl}
                    onChangeText={setFinalUrl}
                  />
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Optional note for the client (how to open the files, what is included...)"
                    placeholderTextColor={COLORS.placeholder}
                    multiline
                    value={finalNote}
                    onChangeText={setFinalNote}
                  />
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 0 }, submittingFinal && { opacity: 0.7 }]}
                    onPress={handleSubmitFinal}
                    disabled={submittingFinal}
                  >
                    {submittingFinal ? (
                      <ActivityIndicator color={COLORS.onPrimary} />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {stage === 'delivered_locked' ? 'Replace submitted link' : 'Submit final work'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Notes History Log */}
          <Text style={[styles.sectionTitle, { marginTop: 30 }]}>PROGRESS NOTES HISTORY</Text>
          {booking.progressNotes && booking.progressNotes.length > 0 ? (
            [...booking.progressNotes].reverse().map((item, idx) => (
              <View key={item.id || idx} style={[styles.infoCard, { marginBottom: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12 }}>
                    Progress: {item.progress}%
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 10 }}>{item.timestamp}</Text>
                </View>
                <Text style={{ color: COLORS.text, fontSize: 13, marginBottom: 8 }}>{item.note}</Text>

                {item.attachmentImage && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setPreviewImageUri(item.attachmentImage)}
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: COLORS.primary,
                      backgroundColor: COLORS.inputBg,
                      marginTop: 4,
                      marginBottom: 8,
                      position: 'relative'
                    }}
                  >
                    <Image
                      source={{ uri: item.attachmentImage }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    <View style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      padding: 5,
                      borderRadius: 8
                    }}>
                      <Feather name="maximize-2" size={12} color={COLORS.primary} />
                    </View>
                  </TouchableOpacity>
                )}

                {item.attachmentLink && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: COLORS.inputBg,
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: COLORS.primary
                    }}
                    onPress={() => {
                      const url = item.attachmentLink.startsWith('http')
                        ? item.attachmentLink
                        : `https://${item.attachmentLink}`;
                      Linking.openURL(url).catch(() => {});
                    }}
                  >
                    <Feather name="external-link" size={14} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <Text style={{ color: COLORS.primary, fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {item.attachmentLink}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.infoCard}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                {booking.latestNote || 'No progress notes added yet.'}
              </Text>
            </View>
          )}

        </ScrollView>

        {/* Full-Resolution Image Lightbox Modal */}
        <Modal visible={previewImageUri !== null} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <TouchableOpacity
              onPress={() => setPreviewImageUri(null)}
              style={{
                position: 'absolute',
                top: 40,
                right: 25,
                zIndex: 10,
                backgroundColor: COLORS.cardInactiveBg,
                width: 40,
                height: 40,
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.primary
              }}
            >
              <Feather name="x" size={22} color={COLORS.primary} />
            </TouchableOpacity>

            {previewImageUri && (
              <Image
                source={{ uri: previewImageUri }}
                style={{ width: '100%', height: '80%', borderRadius: 12 }}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

        <OfferModal
          visible={offerModalVisible}
          booking={booking}
          senderName={currentUserData?.fullName || currentUserData?.name || 'The freelancer'}
          onClose={() => setOfferModalVisible(false)}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}