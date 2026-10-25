import React, { useState, useEffect } from 'react';
import { 
  Text, View, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Image, Linking, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { COLORS, styles } from '../styles';

import { auth, db } from '../firebaseConfig';
import { 
  doc, onSnapshot, updateDoc, getDoc, getDocs, 
  collection, query, where, addDoc, arrayUnion, serverTimestamp 
} from 'firebase/firestore';

export default function ClientBookingDetailScreen({ route, navigation }) {
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fullscreen Image Lightbox State
  const [previewImageUri, setPreviewImageUri] = useState(null);

  // Dispute Modal & 3-Way Group Chat State
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [groupMessage, setGroupMessage] = useState('');
  const [sendingGroupMsg, setSendingGroupMsg] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then((snap) => {
        if (snap.exists()) setCurrentUserData(snap.data());
      });
    }

    if (!bookingId) return;
    const unsub = onSnapshot(doc(db, 'bookings', bookingId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setBooking(data);
        if (data.rating) setRating(data.rating);
        if (data.reviewText) setReviewText(data.reviewText);
      }
    });
    return () => unsub();
  }, [bookingId]);

  const isAdmin = 
    (currentUserData?.role || currentUserData?.accountType || '').toLowerCase() === 'admin' ||
    auth.currentUser?.email?.toLowerCase() === 'admin@skillswap.ph';

  const handleOpenChat = async () => {
    if (!auth.currentUser || !booking) return;
    try {
      const qChats = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      const snap = await getDocs(qChats);
      let chatId = null;

      snap.forEach((d) => {
        if (d.data().participants?.includes(booking.freelancerId)) {
          chatId = d.id;
        }
      });

      if (!chatId) {
        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [auth.currentUser.uid, booking.freelancerId],
          clientId: auth.currentUser.uid,
          clientName: booking.clientName || 'Client',
          freelancerId: booking.freelancerId,
          freelancerName: booking.freelancerName || 'Freelancer',
          projectTitle: booking.serviceTitle || 'Service',
          lastMessage: 'Opened chat from booking details',
          updatedAt: serverTimestamp()
        });
        chatId = newChat.id;
      }

      navigation.navigate('Chat', {
        chatId,
        otherUserName: booking.freelancerName || 'Freelancer'
      });
    } catch (error) {
      console.error('Error navigating to chat:', error);
    }
  };

  const handleReportDispute = async () => {
    if (!disputeReason.trim()) {
      Alert.alert('Missing Reason', 'Please describe the issue so an Admin can review it.');
      return;
    }
    setSubmittingDispute(true);
    try {
      const senderName = currentUserData?.fullName || currentUserData?.name || booking.clientName || 'Client';
      const initialChatEntry = {
        id: Date.now().toString(),
        senderId: auth.currentUser?.uid,
        senderName: senderName,
        senderRole: isAdmin ? 'ADMIN' : 'CLIENT',
        text: `⚠️ DISPUTE OPENED: ${disputeReason.trim()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'disputed',
        disputeStatus: 'open',
        disputeReason: disputeReason.trim(),
        disputeMessages: arrayUnion(initialChatEntry),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'disputes'), {
        bookingId: bookingId,
        serviceTitle: booking.serviceTitle || booking.projectTitle || 'Service Booking',
        clientId: booking.clientId,
        clientName: booking.clientName || 'Client',
        freelancerId: booking.freelancerId,
        freelancerName: booking.freelancerName || 'Freelancer',
        price: booking.price || 0,
        reason: disputeReason.trim(),
        status: 'open',
        createdAt: serverTimestamp()
      });

      setDisputeReason('');
      setDisputeModalVisible(false);
      Alert.alert('Dispute Opened', 'A 3-way Dispute Group Chat with the Freelancer and SkillSwap Admin is now active below!');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Send message in the 3-Way Dispute Group Chat (Client + Freelancer + Admin)
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

      setGroupMessage('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSendingGroupMsg(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking) return;
    setSubmitting(true);

    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'completed',
        progress: 100,
        rating: rating,
        reviewText: reviewText.trim(),
        reviewedAt: serverTimestamp()
      });

      if (booking.freelancerId) {
        const qRated = query(
          collection(db, 'bookings'),
          where('freelancerId', '==', booking.freelancerId)
        );
        const snap = await getDocs(qRated);
        let totalStars = rating;
        let count = 1;

        snap.forEach((d) => {
          if (d.id !== bookingId && d.data().rating) {
            totalStars += Number(d.data().rating);
            count += 1;
          }
        });

        const avgRating = parseFloat((totalStars / count).toFixed(1));
        const userRef = doc(db, 'users', booking.freelancerId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            rating: avgRating,
            reviewCount: count
          });
        }
      }

      Alert.alert('Thank You!', 'Your rating and review have been submitted.');
    } catch (error) {
      Alert.alert('Error', 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking) {
    return (
      <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      </LinearGradient>
    );
  }

  const progress = booking.progress || 0;
  const isDisputed = (booking.status || '').toLowerCase() === 'disputed' || booking.disputeStatus === 'open' || (booking.disputeMessages && booking.disputeMessages.length > 0);

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={[styles.chatHeaderBg, { paddingVertical: 16, marginBottom: 15 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
            <Feather name="chevron-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }}>
            {isAdmin ? 'Admin Booking & Dispute View' : 'Project Progress & Review'}
          </Text>
          <TouchableOpacity style={styles.detailsBtn} onPress={handleOpenChat}>
            <Text style={[styles.detailsBtnText, { color: COLORS.primary }]}>1-on-1 Chat</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
          
          {/* Overview Card */}
          <View style={[styles.bookingCard, isDisputed && { borderColor: '#FF4C4C' }]}>
            <View style={styles.bookingTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookingTitle}>{booking.serviceTitle || booking.projectTitle}</Text>
                
                <TouchableOpacity 
                  onPress={() => navigation.navigate('FreelancerPortfolio', { 
                    freelancerId: booking.freelancerId, 
                    freelancerName: booking.freelancerName 
                  })}
                >
                  <Text style={[styles.bookingDetails, { color: COLORS.primary, textDecorationLine: 'underline' }]}>
                    Freelancer: {booking.freelancerName} (View Portfolio →)
                  </Text>
                </TouchableOpacity>
                <Text style={styles.bookingDetails}>Client: {booking.clientName || 'Client'}</Text>

                <Text style={[styles.bookingDetails, { color: COLORS.primary, fontWeight: 'bold', marginTop: 4 }]}>
                  Rate: ₱ {booking.price || 0}
                </Text>
              </View>
              <View style={[styles.statusPill, { borderColor: booking.status === 'disputed' ? '#FF4C4C' : COLORS.primary }]}>
                <Text style={[styles.statusText, { color: booking.status === 'disputed' ? '#FF4C4C' : COLORS.primary }]}>
                  {(booking.status || 'PENDING').toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={[styles.progressRow, { marginTop: 12 }]}>
              <View style={[styles.progressBarBg, { height: 8, borderRadius: 4 }]}>
                <View style={[styles.progressBarFill, { width: `${progress}%`, height: 8, borderRadius: 4 }]} />
              </View>
              <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>{progress}%</Text>
            </View>

            <View style={{ flexDirection: 'row', marginTop: 15 }}>
              <TouchableOpacity 
                style={[styles.btnDark, { flex: 1, paddingVertical: 12, borderRadius: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }]}
                onPress={handleOpenChat}
              >
                <Feather name="message-circle" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.btnDarkText}>Message Freelancer</Text>
              </TouchableOpacity>

              {booking.status !== 'disputed' && (
                <TouchableOpacity 
                  style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#FF4C4C', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                  onPress={() => setDisputeModalVisible(true)}
                >
                  <Feather name="alert-triangle" size={14} color="#FF4C4C" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FF4C4C', fontWeight: 'bold', fontSize: 12 }}>Open Dispute</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

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
                    Reported Issue: "{booking.disputeReason}"
                  </Text>
                  {booking.adminResolution && (
                    <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>
                      ✓ Admin Decision: {booking.adminResolution}
                    </Text>
                  )}
                </View>
              )}

              {/* Group Chat Messages Feed */}
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

              {/* Group Chat Input Box */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 10, marginRight: 8 }]}
                  placeholder={isAdmin ? "Reply as [ADMIN] to both parties..." : "Message Admin & Freelancer..."}
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

          {/* Freelancer Progress Updates */}
          <Text style={styles.sectionTitle}>FREELANCER PROGRESS UPDATES</Text>
          {booking.progressNotes && booking.progressNotes.length > 0 ? (
            [...booking.progressNotes].reverse().map((item, idx) => (
              <View key={item.id || idx} style={[styles.infoCard, { marginBottom: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12 }}>
                    Milestone: {item.progress}%
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
                      borderColor: COLORS.primary,
                      marginTop: 4
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
                      Open Attached Link: {item.attachmentLink}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.infoCard}>
              <Text style={{ color: COLORS.text, fontSize: 13 }}>
                {booking.latestNote || 'Waiting for freelancer to post project updates.'}
              </Text>
            </View>
          )}

          {/* Rate & Review Section */}
          <Text style={[styles.sectionTitle, { marginTop: 25 }]}>RATE & REVIEW FREELANCER</Text>
          <View style={styles.infoCard}>
            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
              How was your experience with {booking.freelancerName}?
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 12 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} style={{ paddingHorizontal: 8 }}>
                  <FontAwesome
                    name={star <= rating ? 'star' : 'star-o'}
                    size={30}
                    color="#F4C77F"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top', marginTop: 10, marginBottom: 12 }]}
              placeholder="Write your feedback or review about their service..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={reviewText}
              onChangeText={setReviewText}
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSubmitReview}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {booking.rating ? 'Update Rating & Review' : 'Complete & Submit Review'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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

        {/* Report Dispute Modal */}
        <Modal visible={disputeModalVisible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: COLORS.cardInactiveBg, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.inputBorder }}>
              <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: 'bold', marginBottom: 6 }}>
                Open 3-Way Dispute with Admin
              </Text>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginBottom: 15 }}>
                Describe the issue. This booking will stay active and open a 3-way group chat between you, the Freelancer, and a SkillSwap Admin.
              </Text>

              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Explain what happened..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={disputeReason}
                onChangeText={setDisputeReason}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity style={styles.declineBtn} onPress={() => setDisputeModalVisible(false)}>
                  <Text style={styles.declineBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.acceptBtn, { backgroundColor: '#FF4C4C' }]}
                  onPress={handleReportDispute}
                  disabled={submittingDispute}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>Start Dispute Group Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}